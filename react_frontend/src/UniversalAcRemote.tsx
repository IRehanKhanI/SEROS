import React, { useState, useEffect } from 'react';

export const AC_VENDOR_PROTOCOLS = [
  'COOLIX', 'DAIKIN', 'DAIKIN2', 'MITSUBISHI_AC', 'MITSUBISHI_HEAVY_152',
  'MITSUBISHI_HEAVY_88', 'VOLTAS', 'LG', 'LG2', 'SAMSUNG_AC', 'HITACHI_AC',
  'CARRIER_AC', 'GREE', 'PANASONIC_AC', 'HAIER_AC', 'MIDEA', 'FUJITSU_AC',
  'ELECTRA_AC', 'WHIRLPOOL_AC', 'TCL112AC', 'KELVINATOR', 'TOSHIBA_AC',
  'SHARP_AC', 'TECO', 'SANYO_AC', 'AMCOR', 'ARGO', 'CORONA_AC'
] as const;

export type AcVendorProtocol = typeof AC_VENDOR_PROTOCOLS[number];
export type AcMode = 'cool' | 'heat' | 'dry' | 'fan' | 'auto';
export type AcFan = 'auto' | 'low' | 'medium' | 'high';

interface UniversalAcRemoteProps {
  apiBaseUrl?: string;
  esp32Url?: string;
  initialProtocol?: string;
  onStateChange?: (state: { power: boolean; temperature: number; mode: string; fan: string; protocol: string }) => void;
  compact?: boolean;
  showBrandSelector?: boolean;
}

export const UniversalAcRemote: React.FC<UniversalAcRemoteProps> = ({
  apiBaseUrl = 'http://localhost:8000',
  esp32Url = 'http://192.168.137.97',
  initialProtocol = 'MITSUBISHI_AC',
  onStateChange,
  compact = false,
  showBrandSelector = false,
}) => {
  const [protocol, setProtocol] = useState<string>(initialProtocol || 'MITSUBISHI_AC');
  const [power, setPower] = useState<boolean>(false);
  const [temperature, setTemperature] = useState<number>(24);
  const [mode, setMode] = useState<AcMode>('cool');
  const [fan, setFan] = useState<AcFan>('auto');
  const [isLearning, setIsLearning] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('Ready. Point remote to learn or pick a vendor.');
  const [isBusy, setIsBusy] = useState<boolean>(false);

  // Poll AC status from backend or ESP32
  const fetchStatus = async () => {
    try {
      // Prefer backend proxy to avoid CORS/network route blocks, with ESP32 fallback
      let res = await fetch(`${apiBaseUrl}/api/ac/status/`, { method: 'GET' }).catch(() => null);
      if (!res || !res.ok) {
        res = await fetch(`${esp32Url}/api/status`, { method: 'GET' }).catch(() => null);
      }
      if (res && res.ok) {
        const data = await res.json();
        if (data.ac_protocol && data.ac_protocol !== 'UNKNOWN') {
          setProtocol(data.ac_protocol);
        } else if (data.protocol) {
          setProtocol(data.protocol);
        }
        if (typeof data.ac_power === 'boolean') setPower(data.ac_power);
        else if (typeof data.power === 'boolean') setPower(data.power);

        if (data.ac_temperature) setTemperature(Number(data.ac_temperature));
        else if (data.temperature && data.temperature <= 32) setTemperature(Number(data.temperature));

        if (data.ac_mode) setMode(data.ac_mode.toLowerCase() as AcMode);
        else if (data.mode) setMode(data.mode.toLowerCase() as AcMode);

        if (data.ac_fan) setFan(data.ac_fan.toLowerCase() as AcFan);
        else if (data.fan) setFan(data.fan.toLowerCase() as AcFan);

        if (typeof data.learning === 'boolean') setIsLearning(data.learning);
        if (data.message) setStatusMessage(data.message);
      }
    } catch {
      // offline fallback
    }
  };

  useEffect(() => {
    void fetchStatus();
    const timer = setInterval(() => {
      void fetchStatus();
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Generic dispatch helper trying backend first, then direct ESP32
  const sendCommand = async (backendPath: string, esp32Path: string) => {
    setIsBusy(true);
    try {
      let res = await fetch(`${apiBaseUrl}${backendPath}`, { method: 'POST' }).catch(() => null);
      if (!res || !res.ok) {
        res = await fetch(`${esp32Url}${esp32Path}`, { method: 'GET' }).catch(() => null);
      }
      if (res && res.ok) {
        const payload = await res.json().catch(() => ({}));
        if (payload.message) setStatusMessage(payload.message);
      }
    } catch {
      // Simulated locally if offline
    } finally {
      setIsBusy(false);
      onStateChange?.({ power, temperature, mode, fan, protocol });
    }
  };

  // 1. Learn Remote Auto-Detect
  const handleToggleLearn = async () => {
    if (isLearning) {
      setIsLearning(false);
      setStatusMessage('Learning cancelled.');
      await sendCommand('/api/ac/cancel/', '/api/ac/cancel');
    } else {
      setIsLearning(true);
      setStatusMessage('Listening for remote... point remote at receiver and press a button.');
      await sendCommand('/api/ac/learn/', '/api/ac/learn');
    }
  };

  // 2. Select Vendor Protocol
  const handleSelectVendor = async (selectedVendor: string) => {
    if (!selectedVendor) return;
    setProtocol(selectedVendor);
    setStatusMessage(`Protocol set: ${selectedVendor}. Test with POWER ON or Temp.`);
    await sendCommand(
      `/api/ac/vendor/?vendor=${encodeURIComponent(selectedVendor)}`,
      `/api/ac/vendor?vendor=${encodeURIComponent(selectedVendor)}`
    );
  };

  // 3. Change Temperature
  const handleTempAdjust = async (delta: number) => {
    const nextTemp = Math.max(16, Math.min(30, temperature + delta));
    setTemperature(nextTemp);
    setPower(true);
    setStatusMessage(`AC Command Sent: ${protocol}, Power: ON, Temp: ${nextTemp}°C, Mode: ${mode}`);
    await sendCommand(
      `/api/ac/temp/?value=${nextTemp}`,
      `/api/ac/temp?value=${nextTemp}`
    );
  };

  // 4. Power Toggle
  const handleSetPower = async (on: boolean) => {
    setPower(on);
    setStatusMessage(`AC Command Sent: ${protocol}, Power: ${on ? 'ON' : 'OFF'}, Temp: ${temperature}°C, Mode: ${mode}`);
    await sendCommand(
      `/api/ac/power/?on=${on ? 1 : 0}`,
      `/api/ac/power?on=${on ? 1 : 0}`
    );
  };

  // 5. Mode Select
  const handleSelectMode = async (m: AcMode) => {
    setMode(m);
    setPower(true);
    setStatusMessage(`AC Command Sent: ${protocol}, Power: ON, Temp: ${temperature}°C, Mode: ${m}`);
    await sendCommand(
      `/api/ac/mode/?mode=${m}`,
      `/api/ac/mode?mode=${m}`
    );
  };

  // 6. Fan Speed Select
  const handleSelectFan = async (f: AcFan) => {
    setFan(f);
    setStatusMessage(`AC Command Sent: ${protocol}, Fan: ${f}`);
    await sendCommand(
      `/api/ac/fan/?fan=${f}`,
      `/api/ac/fan?fan=${f}`
    );
  };

  // 7. Resend Current State
  const handleResendState = async () => {
    setStatusMessage(`Resending current state (${protocol}, ${temperature}°C, ${mode}, ${fan})...`);
    await sendCommand('/api/ac/send/', '/api/ac/send');
  };

  return (
    <div className={`universal-ac-remote-card ${compact ? 'compact' : ''}`}>
      {/* Title as in screenshot */}
      <h2 className="uac-title">UNIVERSAL AC REMOTE</h2>

      {showBrandSelector && (
        <>
          {/* RE-LEARN REMOTE button */}
          <div className="uac-learn-wrap">
            <button
              type="button"
              onClick={handleToggleLearn}
              className={`uac-btn-amber ${isLearning ? 'learning-active' : ''}`}
              disabled={isBusy}
            >
              {isLearning ? 'CANCEL LEARNING' : 'RE-LEARN REMOTE'}
            </button>
          </div>

          {isLearning && (
            <div className="uac-listening-banner">
              <span className="pulse-dot" /> LISTENING FOR AC REMOTE (Press any button)...
            </div>
          )}

          {/* Protocol Dropdown Selector */}
          <div className="uac-vendor-section">
            <label className="uac-vendor-label">Or Select Vendor Protocol Manually:</label>
            <select
              value={protocol}
              onChange={(e) => handleSelectVendor(e.target.value)}
              className="uac-vendor-select"
            >
              <option value="">-- Select AC Brand / Protocol --</option>
              {AC_VENDOR_PROTOCOLS.map((vnd) => (
                <option key={vnd} value={vnd}>
                  {vnd}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      {/* Active Protocol Badge */}
      <div className="uac-active-protocol" style={{ margin: '4px auto 10px', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 14px', borderRadius: 20, background: '#EAF5DD', border: '1px solid #C2E2A8', color: '#006934', fontSize: '13px', fontWeight: 700 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#006934', display: 'inline-block' }} />
        Brand: <strong style={{ color: '#006934', fontWeight: 900 }}>{protocol || 'MITSUBISHI_AC'}</strong>
      </div>

      {/* Giant 24°C Yellow Temperature Display */}
      <div className="uac-temp-display">{temperature}&deg;C</div>

      {/* Temperature Adjustment Buttons */}
      <div className="uac-btn-row">
        <button
          type="button"
          className="uac-btn-blue"
          onClick={() => handleTempAdjust(-1)}
          disabled={temperature <= 16}
        >
          &minus; 1&deg;C
        </button>
        <button
          type="button"
          className="uac-btn-blue"
          onClick={() => handleTempAdjust(1)}
          disabled={temperature >= 30}
        >
          &#43; 1&deg;C
        </button>
      </div>

      {/* Power Buttons */}
      <div className="uac-btn-row">
        <button
          type="button"
          className={`uac-btn-green ${power ? 'active' : ''}`}
          onClick={() => handleSetPower(true)}
        >
          POWER ON
        </button>
        <button
          type="button"
          className={`uac-btn-red ${!power ? 'active' : ''}`}
          onClick={() => handleSetPower(false)}
        >
          POWER OFF
        </button>
      </div>

      {/* Status Summary Line */}
      <div className="uac-status-summary">
        Mode: <strong>{mode}</strong> &bull; Fan: <strong>{fan}</strong> &bull; Power: <strong>{power ? 'ON' : 'OFF'}</strong>
      </div>

      {/* Mode Buttons */}
      <div className="uac-mode-row">
        {(['cool', 'heat', 'dry', 'fan', 'auto'] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={`uac-btn-slate ${mode === m ? 'active' : ''}`}
            onClick={() => handleSelectMode(m)}
          >
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>

      {/* Fan Speed Buttons */}
      <div className="uac-fan-row">
        <button
          type="button"
          className={`uac-btn-slate ${fan === 'auto' ? 'active' : ''}`}
          onClick={() => handleSelectFan('auto')}
        >
          Fan Auto
        </button>
        <button
          type="button"
          className={`uac-btn-slate ${fan === 'low' ? 'active' : ''}`}
          onClick={() => handleSelectFan('low')}
        >
          Low
        </button>
        <button
          type="button"
          className={`uac-btn-slate ${fan === 'medium' ? 'active' : ''}`}
          onClick={() => handleSelectFan('medium')}
        >
          Med
        </button>
        <button
          type="button"
          className={`uac-btn-slate ${fan === 'high' ? 'active' : ''}`}
          onClick={() => handleSelectFan('high')}
        >
          High
        </button>
      </div>

      {/* RESEND CURRENT STATE Button */}
      <div className="uac-resend-wrap">
        <button
          type="button"
          className="uac-btn-cyan"
          onClick={handleResendState}
          disabled={isBusy}
        >
          RESEND CURRENT STATE
        </button>
      </div>

      {/* Status Message Footer */}
      {statusMessage && (
        <div className="uac-status-footer">
          <span>{statusMessage}</span>
        </div>
      )}
    </div>
  );
};

export default UniversalAcRemote;
