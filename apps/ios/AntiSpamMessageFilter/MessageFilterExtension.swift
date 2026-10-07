// MessageFilterExtension.swift — AntiSpam BR (iOS-2)
// Entry point da ILMessageFilterExtension: aplica heurísticas LOCAIS
// (MessageFilterHeuristics.swift) sem rede. iOS-3 adicionará deferred
// lookup com k-anonymity conforme contrato da Apple.
//
// PRIVACIDADE: a extensão não envia o texto a lugar nenhum; só classifica.
// O texto completo jamais sai do dispositivo (missão §SMS: "Nunca enviar o
// texto completo para servidor por padrão").

import IdentityLookup
import os.log

final class MessageFilterExtension: ILMessageFilterExtension {

    private static let log = OSLog(subsystem: "br.antispam.app", category: "message-filter")
}

extension MessageFilterExtension: ILMessageFilterExtensionHandling {

    func handle(
        _ request: ILMessageFilterQueryRequest,
        context: ILMessageFilterExtensionContext,
        completion: @escaping (ILMessageFilterQueryResponse) -> Void
    ) {
        let response = ILMessageFilterQueryResponse()

        let sender = request.sender ?? nil
        let body = request.messageBody ?? ""

        let result = MessageFilterHeuristics.analyze(sender: sender, body: body)

        os_log("SMS analisado: verdict=%{public}@ score=%d sinais=%{public}@",
               log: Self.log, type: .info,
               result.verdict.rawValue, result.score,
               result.signals.map(\.rawValue).joined(separator: ","))

        switch result.verdict {
        case .scam:
            // Categoria "junk" remove da caixa principal (Filtragem de mensagens desconhecidas)
            response.action = .junk
        case .suspect:
            // "promotion" é a categoria de menor severidade disponível p/ filtro
            response.action = .promotion
        case .safe:
            response.action = .allow
        }

        // iOS-3: aqui entrará context.deferQueryRequest(to: endpoint)
        // com hash-prefix (k-anonymity) — nunca o texto completo.

        completion(response)
    }
}
