// MessageFilterHeuristics.swift — AntiSpam BR (iOS-2)
// Port das heurísticas de src/core/sms/heuristics.ts para uso dentro da
// ILMessageFilterExtension. Mesmos pesos/thresholds do Android/JS (fonte única
// de inteligência, implementação nativa separada — missão §PRINCÍPIOS 12).
//
// PRIVACIDADE: roda dentro da extensão; nada é enviado a rede nesta versão
// (heurísticas locais apenas). Rede (deferred) ficará para iOS-3 com k-anonymity.

import Foundation

/// Veredito alinhado com o engine TS: SAFE / SUSPECT / SCAM.
enum SmsVerdict: String {
    case safe = "SAFE"
    case suspect = "SUSPECT"
    case scam = "SCAM"
}

/// Sinais alinhados com SmsSignalReason (src/core/sms/types.ts).
enum SmsSignal: String, CaseIterable {
    case urlShortener = "URL_SHORTENER"
    case ipUrl = "IP_URL"
    case homoglyph = "HOMOGLYPH"
    case suspiciousTld = "SUSPICIOUS_TLD"
    case suspiciousDomain = "SUSPICIOUS_DOMAIN"
    case httpInsecure = "HTTP_INSECURE"
    case pixKey = "PIX_KEY"
    case boletoCode = "BOLETO_CODE"
    case bankImpersonation = "BANK_IMPERSONATION"
    case deliveryFee = "DELIVERY_FEE"
    case fakeSupport = "FAKE_SUPPORT"
    case urgency = "URGENCY"
    case passwordRequest = "PASSWORD_REQUEST"
    case otpRequest = "OTP_REQUEST"
    case otpLegitSender = "OTP_LEGIT_SENDER"
    case moneyPressure = "MONEY_PRESSURE"
    case senderUnknown = "SENDER_UNKNOWN"
    case noSignal = "NO_SIGNAL"
}

struct SmsAnalysisResult {
    let verdict: SmsVerdict
    let score: Int
    let signals: Set<SmsSignal>
    let explanation: [String]
}

/// Thresholds espelhados de SMS_THRESHOLDS (smsEngine.ts).
private enum Thresholds {
    static let suspectAt = 25
    static let scamAt = 55
    static let legitOtpBonus = -15
    static let hardUrlEvidence = 40
    static let shortenerPlusPressure = 20
}

struct MessageFilterHeuristics {

    // MARK: - Listas curadas (paridade com urlExtractor.ts)

    static let shorteners: Set<String> = [
        "bit.ly", "tinyurl.com", "cutt.ly", "shorturl.at", "rebrand.ly", "is.gd",
        "t.co", "goo.gl", "ow.ly", "buff.ly", "rb.gy", "tiny.cc", "shorte.st",
        "s.id", "lnkd.in", "urlz.fr", "shrtco.de",
    ]

    static let suspiciousTlds: Set<String> = [
        "tk", "ml", "ga", "cf", "gq", "xyz", "top", "buzz", "click", "icu",
    ]

    /// Marca → domínios oficiais (paridade com BRAND_OFFICIAL_HOSTS).
    static let brandOfficialHosts: [String: Set<String>] = [
        "nubank": ["nubank.com.br"],
        "itau": ["itau.com.br"],
        "bradesco": ["bradesco.com.br"],
        "bancodobrasil": ["bb.com.br"],
        "caixa": ["caixa.gov.br"],
        "santander": ["santander.com.br"],
        "inter": ["bancointer.com.br"],
        "c6bank": ["c6bank.com.br"],
        "picpay": ["picpay.com"],
        "mercadopago": ["mercadopago.com.br", "mercadopago.com"],
        "mercadolivre": ["mercadolivre.com.br", "mercadolivre.com"],
        "amazon": ["amazon.com.br"],
        "correios": ["correios.com.br"],
        "gov": ["gov.br"],
        "anatel": ["gov.br"],
        "receita": ["gov.br"],
    ]

    // MARK: - Regex (equivalentes ao TS)

    private static let urlRegex = try! NSRegularExpression(
        pattern: "(?:https?://|www\\.)[^\\s<>\"']+|\\b(?:[a-z0-9-]+\\.)+[a-z]{2,}/[^\\s<>\"']*",
        options: [.caseInsensitive]
    )
    private static let pixKeyRegex = try! NSRegularExpression(
        pattern: "(?:chave\\s*(?:pix|do\\s*pix)|pix\\s*(?:de|para)\\s*(?:[a-z]+\\s+)?\\d{3})",
        options: [.caseInsensitive]
    )
    private static let cpfRegex = try! NSRegularExpression(pattern: "\\b\\d{3}\\.?\\d{3}\\.?\\d{3}-?\\d{2}\\b")
    private static let uuidRegex = try! NSRegularExpression(
        pattern: "\\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\b",
        options: [.caseInsensitive]
    )
    private static let boletoRegex = try! NSRegularExpression(
        pattern: "\\b\\d{5}[.\\s]?\\d{5}[.\\s]?\\d{5}[.\\s]?\\d{6}[.\\s]?\\d{5}[.\\s]?\\d{6}\\b"
    )
    private static let urgencyRegex = try! NSRegularExpression(
        pattern: "\\b(?:urgente|imediatamente|ultima\\s*chance|ultimo\\s*aviso|hoje\\s*ate|nas\\s*proximas\\s*horas?|em\\s*\\d{1,2}\\s*(?:minutos?|horas?)|conta\\s*(?:sera|será)\\s*bloqueada|acesso\\s*suspenso|evite\\s*o\\s*bloqueio|e\\s*urgente|é\\s*urgente)",
        options: [.caseInsensitive]
    )
    private static let passwordRegex = try! NSRegularExpression(
        pattern: "\\b(?:senha|sua\\s*password|dados\\s*da\\s*sua\\s*conta|confirme\\s*seus\\s*dados|atualize\\s*seu\\s*cadastro|cadastro\\s*atualizado)",
        options: [.caseInsensitive]
    )
    private static let otpRegex = try! NSRegularExpression(
        pattern: "\\b(?:codigo\\s*de\\s*verificacao|código\\s*de\\s*verificação|codigo\\s*recebido|informe\\s*o\\s*codigo|digite\\s*o\\s*codigo|me\\s*passe\\s*o\\s*codigo|otp)",
        options: [.caseInsensitive]
    )
    private static let moneyRegex = try! NSRegularExpression(
        pattern: "\\b(?:pix|reembolso|restituicao|restituição|premio|prêmio|sorteio|emprestimo\\s*aprovado|empréstimo\\s*aprovado|credito\\s*aprovado|crédito\\s*aprovado|multa|debito|débito|fatura\\s*(?:atrasada|vencida)|regularize|taxa\\s*de\\s*(?:envio|liberacao|liberação))",
        options: [.caseInsensitive]
    )
    private static let deliveryRegex = try! NSRegularExpression(
        pattern: "\\b(?:sua\\s*(?:encomenda|entrega|pacote)|encomenda\\s*parou|correios?\\s*(?:pacote|taxa)|taxa\\s*de\\s*(?:entrega|liberacao|liberação)|alfandega|alfândega|liberar\\s*a\\s*(?:entrega|encomenda)|reagendar\\s*a\\s*entrega)",
        options: [.caseInsensitive]
    )
    private static let supportRegex = try! NSRegularExpression(
        pattern: "\\b(?:central\\s*de\\s*atendimento|suporte\\s*(?:tecnico|técnico|ao\\s*cliente)|ligue\\s*para|ligamos\\s*para\\s*você|atendimento\\s*(?:ao\\s*cliente|exclusivo))",
        options: [.caseInsensitive]
    )
    private static let ipHostRegex = try! NSRegularExpression(
        pattern: "^(?:\\d{1,3}\\.){3}\\d{1,3}$"
    )

    // Remetentes legítimos de OTP (paridade com LEGIT_OTP_SENDERS).
    static let legitOtpSenders: Set<String> = [
        "google", "whatsapp", "telegram", "nubank", "itau", "caixa", "bradesco",
        "santander", "inter", "picpay", "mercadolivre", "amazon", "govbr", "gov.br",
    ]

    // MARK: - API principal

    /// Analisa uma mensagem (mesmo contrato de analyzeSms em smsEngine.ts).
    static func analyze(sender: String?, body: String) -> SmsAnalysisResult {
        var score = 0
        var signals = Set<SmsSignal>()
        var explanation: [String] = []
        var strongUrlEvidence = false

        let lowered = body.lowercased()

        // ---------- 1. URLs ----------
        let urls = extractHosts(from: body)
        for host in urls {
            if shorteners.contains(host) {
                score += 15; signals.insert(.urlShortener)
                explanation.append("Link encurtado: \(host)")
            }
            if matches(ipHostRegex, host) {
                score += 30; signals.insert(.ipUrl); strongUrlEvidence = true
                explanation.append("Link para IP direto: \(host)")
            }
            if host.contains("xn--") {
                score += 25; signals.insert(.homoglyph); strongUrlEvidence = true
                explanation.append("Domínio em punycode/IDN (possível disfarce): \(host)")
            }
            if let lastTld = host.split(separator: ".").last, suspiciousTlds.contains(String(lastTld)) {
                score += 20; signals.insert(.suspiciousTld)
                explanation.append("TLD suspeito: \(host)")
            }
            if isImpersonatedDomain(host) {
                score += 30; signals.insert(.suspiciousDomain); strongUrlEvidence = true
                explanation.append("Domínio finge instituição conhecida: \(host)")
            }
            if lowered.contains("http://") {
                score += 10; signals.insert(.httpInsecure)
                explanation.append("Link sem criptografia (http://)")
            }
        }

        // ---------- 2. Heurísticas de texto ----------
        let hasUrgency = matches(urgencyRegex, body)
        let asksSensitive = matches(passwordRegex, body)

        if matches(pixKeyRegex, body) || (lowered.contains("pix") && (matches(cpfRegex, body) || matches(uuidRegex, body))) {
            score += 30; signals.insert(.pixKey)
            explanation.append("Mensagem envolve chave PIX — padrão comum de falso PIX")
        }
        if matches(boletoRegex, body) {
            score += 25; signals.insert(.boletoCode)
            explanation.append("Contém código de barras de boleto — risco de boleto falso")
        }
        let bankMentioned = brandOfficialHosts.keys.first { lowered.contains($0) }
        if bankMentioned != nil && (asksSensitive || hasUrgency) {
            score += 30; signals.insert(.bankImpersonation)
            explanation.append("Cita banco/instituição com pedido de dados ou urgência — padrão de falso banco")
        }
        if matches(deliveryRegex, body) && (matches(moneyRegex, body) || hasUrgency) {
            score += 25; signals.insert(.deliveryFee)
            explanation.append("Fala de entrega/encomenda com taxa ou urgência — padrão de falso Correios/entrega")
        }
        if matches(supportRegex, body) && hasUrgency {
            score += 20; signals.insert(.fakeSupport)
            explanation.append("Falsa central de atendimento com urgência")
        }
        if hasUrgency && !signals.contains(.bankImpersonation) && !signals.contains(.deliveryFee) {
            score += 15; signals.insert(.urgency)
            explanation.append("Urgência artificial — técnica de engenharia social")
        }
        if asksSensitive {
            score += 25; signals.insert(.passwordRequest)
            explanation.append("Pede confirmação de senha/dados da conta")
        }
        if matches(otpRegex, body) {
            score += 25; signals.insert(.otpRequest)
            explanation.append("Pede um código de verificação — golpe do código")
        }
        if matches(moneyRegex, body) && signals.isEmpty {
            score += 12; signals.insert(.moneyPressure)
            explanation.append("Pressão financeira sem contexto claro")
        }

        // ---------- 3. Remetente ----------
        let senderLower = sender?.lowercased().trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if let s = sender, legitOtpSenders.contains(s.lowercased()), signals.contains(.otpRequest) {
            score += Thresholds.legitOtpBonus
            signals.insert(.otpLegitSender)
            explanation.append("Remetente é fonte conhecida de OTP legítimo (score reduzido)")
        }
        if senderLower.isEmpty && score > 0 && !signals.contains(.otpLegitSender) {
            signals.insert(.senderUnknown)
        }

        // ---------- 4. Combos ----------
        let pressure = signals.contains(.moneyPressure) || signals.contains(.urgency)
            || signals.contains(.pixKey) || signals.contains(.deliveryFee)
        if signals.contains(.urlShortener) && pressure {
            score += Thresholds.shortenerPlusPressure
            explanation.append("Link encurtado + pressão financeira/urgência — padrão de smishing")
        }
        if signals.contains(.pixKey) && signals.contains(.urgency) {
            score += Thresholds.shortenerPlusPressure
            explanation.append("PIX com urgência — padrão clássico de falso PIX")
        }

        // ---------- 5. Veredito ----------
        let finalScore = max(0, min(100, score))
        var verdict: SmsVerdict = .safe
        if finalScore >= Thresholds.scamAt || (strongUrlEvidence && finalScore >= Thresholds.hardUrlEvidence) {
            verdict = .scam
        } else if finalScore >= Thresholds.suspectAt {
            verdict = .suspect
        }

        if signals.isEmpty { signals.insert(.noSignal) }

        return SmsAnalysisResult(
            verdict: verdict,
            score: finalScore,
            signals: signals,
            explanation: Array(explanation.prefix(10))
        )
    }

    // MARK: - Helpers

    /// Extrai hosts das URLs do texto (paridade de comportamento com extractUrls).
    static func extractHosts(from body: String) -> [String] {
        let range = NSRange(body.startIndex..., in: body)
        let matches = urlRegex.matches(in: body, options: [], range: range)
        var hosts: [String] = []
        var seen = Set<String>()
        for m in matches {
            guard let r = Range(m.range, in: body) else { continue }
            var raw = String(body[r])
            // limpa pontuação final
            while let last = raw.last, ".,;:!?)".contains(last) { raw.removeLast() }
            var host = raw.lowercased()
                .replacingOccurrences(of: "^https?://", with: "", options: .regularExpression)
                .replacingOccurrences(of: "^www\\.", with: "", options: .regularExpression)
            host = String(host.split(separator: "/").first ?? "")
            host = String(host.split(separator: "?").first ?? "")
            host = String(host.split(separator: "#").first ?? "")
            host = String(host.split(separator: ":").first ?? "")
            if !host.isEmpty && !seen.contains(host) {
                seen.insert(host)
                hosts.append(host)
            }
        }
        return hosts
    }

    /// Impersonação de marca (paridade com isImpersonatedDomain):
    /// marca precisa estar no domínio registrável para ser oficial.
    static func isImpersonatedDomain(_ host: String) -> Bool {
        let parts = host.split(separator: ".").map(String.init)
        guard parts.count >= 2 else { return false }

        let twoLabelTld = ["com.br", "gov.br", "org.br", "net.br", "edu.br"].contains(parts.suffix(2).joined(separator: "."))
        let registrable = twoLabelTld ? parts.suffix(3).joined(separator: ".") : parts.suffix(2).joined(separator: ".")
        let subdomain = host.hasSuffix(registrable)
            ? String(host.dropLast(registrable.count + 1))
            : ""

        for (brand, officialHosts) in brandOfficialHosts {
            let hostContainsBrand = registrable.contains(brand) || subdomain.contains(brand)
            if !hostContainsBrand { continue }
            let isOfficial = officialHosts.contains { registrable == $0 || host == $0 }
            if !isOfficial { return true }
        }
        return false
    }

    private static func matches(_ regex: NSRegularExpression, _ text: String) -> Bool {
        regex.firstMatch(in: text, options: [], range: NSRange(text.startIndex..., in: text)) != nil
    }
}
