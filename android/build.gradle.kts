// Android Gradle dependency configuration for Meta Wearables Device Access Toolkit (DAT)

plugins {
    id("com.android.application")
    kotlin("android")
}

android {
    namespace = "com.gosledge.metawearable"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.gosledge.metawearable"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
}

dependencies {
    // Meta Wearables Device Access Toolkit Core & Camera
    implementation("com.meta.wearable.dat:mwdat-core:1.0.0")
    implementation("com.meta.wearable.dat:mwdat-camera:1.0.0")

    // Mock Device Kit: only included in debug / test builds
    debugImplementation("com.meta.wearable.dat:mwdat-mockdevice:1.0.0")
}
