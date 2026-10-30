package com.gosledge.metawearable

import android.app.Activity
import android.content.Context
import com.meta.wearable.dat.core.Wearables
import com.meta.wearable.dat.core.types.RegistrationState
import com.meta.wearable.dat.mockdevice.GlassesModel
import com.meta.wearable.dat.mockdevice.MockDeviceKit

/**
 * Unified Wearables Bridge supporting both MockDeviceKit and Physical Smart Glasses.
 * Guarantees identical API contracts whether running in simulation or on hardware.
 */
enum class WearableMode {
    MOCK,
    PHYSICAL
}

data class DeviceStatus(
    val mode: WearableMode,
    val isReady: Boolean,
    val registrationState: String,
    val deviceModel: String
)

class MetaWearableBridge(private val context: Context) {

    var currentMode: WearableMode = WearableMode.MOCK
        private set

    // Mock Device Kit instances
    private var mockKit: MockDeviceKit? = null
    private var simulatedGlasses: Any? = null

    // Physical device registration state
    private var physicalState: RegistrationState = RegistrationState.UNAVAILABLE

    /**
     * Initializes in either MOCK or PHYSICAL mode.
     */
    fun setMode(mode: WearableMode, activity: Activity? = null) {
        currentMode = mode
        when (mode) {
            WearableMode.MOCK -> initializeMockKit()
            WearableMode.PHYSICAL -> initializePhysicalHardware(activity)
        }
    }

    private fun initializeMockKit() {
        val kit = MockDeviceKit.getInstance(context)
        kit.enable()
        val glasses = kit.pairGlasses(GlassesModel.RAYBAN_META).getOrThrow()
        glasses.powerOn()
        glasses.unfold()
        glasses.don()

        mockKit = kit
        simulatedGlasses = glasses
    }

    private fun initializePhysicalHardware(activity: Activity?) {
        // shortcut: In production, requires Developer Mode enabled in the Meta View companion app.
        if (activity != null) {
            Wearables.startRegistration(activity)
        }
    }

    fun getStatus(): DeviceStatus {
        return DeviceStatus(
            mode = currentMode,
            isReady = if (currentMode == WearableMode.MOCK) mockKit != null else physicalState == RegistrationState.REGISTERED,
            registrationState = if (currentMode == WearableMode.MOCK) "REGISTERED (Simulated)" else physicalState.name,
            deviceModel = "Ray-Ban Meta"
        )
    }
}
