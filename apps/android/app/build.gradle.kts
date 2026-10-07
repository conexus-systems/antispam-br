import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ksp)
}

val testKeyB64: String = run {
    val f = rootProject.file("../../data/test-vectors/datasets/TEST_KEY.json")
    Regex("\"public_key_b64\":\\s*\"([^\"]+)\"").find(f.readText())?.groupValues?.get(1) ?: error("TEST_KEY.json sem public_key_b64")
}

/** Chaves de produção: "keyId:base64,keyId2:base64". Vazio até a cerimônia de chaves (ver docs/specs/DATASET_FORMAT.md §6). */
val releaseKeys: String = (findProperty("antispam.datasetKeys") as String?) ?: ""

/** Arquivo .properties da chave de upload, sempre fora do repositório. Sem ele o release sai sem assinatura. */
val uploadSigning: Properties? = (findProperty("antispam.signingProperties") as String?)?.let { path ->
    Properties().apply { file(path).inputStream().use { load(it) } }
}

android {
    namespace = "br.antispam.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.conexus.antispam"
        minSdk = 29
        targetSdk = 36
        versionCode = (findProperty("antispam.versionCode") as String?)?.toInt() ?: 1
        versionName = (findProperty("antispam.versionName") as String?) ?: "0.1.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        buildConfigField("String", "DATASET_BASE_URL", "\"https://datasets.antispam-br.org/br-calls/\"")
        buildConfigField("String", "DATASET_KEYS", "\"$releaseKeys\"")
        buildConfigField("boolean", "ALLOW_TEST_KEYS", "false")
    }

    signingConfigs {
        if (uploadSigning != null) {
            create("upload") {
                storeFile = file(uploadSigning.getProperty("storeFile"))
                storePassword = uploadSigning.getProperty("storePassword")
                keyAlias = uploadSigning.getProperty("keyAlias")
                keyPassword = uploadSigning.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            buildConfigField("String", "DATASET_BASE_URL", "\"http://10.0.2.2:17887/datasets/br-calls/\"")
            buildConfigField("String", "DATASET_KEYS", "\"test-2026:$testKeyB64\"")
            buildConfigField("boolean", "ALLOW_TEST_KEYS", "true")
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (uploadSigning != null) signingConfig = signingConfigs.getByName("upload")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    packaging {
        resources.excludes += setOf("META-INF/versions/9/OSGI-INF/MANIFEST.MF", "META-INF/DEPENDENCIES")
    }
    lint {
        abortOnError = true
        warningsAsErrors = false
        checkReleaseBuilds = true
    }
}

kotlin {
    jvmToolchain(17)
}

ksp {
    arg("room.schemaLocation", "$projectDir/schemas")
}

dependencies {
    implementation(project(":engine"))
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.kotlinx.serialization.json)

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    debugImplementation(libs.androidx.compose.ui.tooling)

    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    ksp(libs.androidx.room.compiler)
    implementation(libs.androidx.work.runtime.ktx)
    implementation(libs.androidx.datastore.preferences)

    testImplementation(libs.junit4)

    androidTestImplementation(libs.androidx.test.ext.junit)
    androidTestImplementation(libs.androidx.test.runner)
    androidTestImplementation(libs.androidx.room.testing)
    androidTestImplementation(libs.androidx.work.testing)
    androidTestImplementation(libs.kotlinx.coroutines.test)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
}
