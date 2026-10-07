/**
 * Config plugin — AntiSpam BR (M2).
 *
 * O serviço de screening é registrado pelo AndroidManifest do módulo local
 * (modules/antispam-screening/.../AndroidManifest.xml), mesclado pelo autolinking.
 * Este plugin apenas garante as permissões que o pipeline precisa no aparelho:
 *   - READ_PHONE_STATE (detalhes da chamada / STIR-Shaken)
 *   - READ_CONTACTS    (resolução LOCAL de contatos — nunca sai do aparelho)
 */
module.exports = function withAntiSpamScreening(config) {
  const { AndroidConfig } = require('@expo/config-plugins');
  return AndroidConfig.Permissions.withPermissions(config, [
    'android.permission.READ_PHONE_STATE',
    'android.permission.READ_CONTACTS',
  ]);
};
