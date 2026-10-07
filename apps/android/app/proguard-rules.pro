# kotlinx.serialization (Manifest/InstalledState no :engine)
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**
-keepclassmembers @kotlinx.serialization.Serializable class ** {
    *** Companion;
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class br.antispam.engine.**$$serializer { *; }

# BouncyCastle: só o Ed25519 é usado; o resto pode ser removido pelo R8
-dontwarn org.bouncycastle.**
