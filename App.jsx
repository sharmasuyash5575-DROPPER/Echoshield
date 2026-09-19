import { useEffect, useRef, useState } from "react";
import "./App.css";

function App() {
  const [listening, setListening] = useState(false);
  const [voiceVerdict, setVoiceVerdict] = useState("");
  const [voiceConfidence, setVoiceConfidence] = useState(0);
  const [voiceAnalyzing, setVoiceAnalyzing] = useState(false);

  const audioChunksRef = useRef([]);
  const analysisTimerRef = useRef(null);
  const [voiceDetected, setVoiceDetected] = useState(false);
  const [signalLevel, setSignalLevel] = useState(0);
  
  

  const [transcript, setTranscript] = useState("");
  const [riskLevel, setRiskLevel] = useState("LOW");
  const [threats, setThreats] = useState([]);

  const [micError, setMicError] = useState("");
  const [speechSupported, setSpeechSupported] = useState(true);
  

  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationRef = useRef(null);
  const recognitionRef = useRef(null);

  const barRefs = useRef([]);

  const barCount = 17;

  /*
   * ==========================================
   * THREAT DETECTION ENGINE
   * ==========================================
   */

  const analyzeSpeech = (text) => {
    const lower = text.toLowerCase();

    const detectedThreats = [];

    // OTP / credential requests
    const credentialWords = [
      "otp",
      "one time password",
      "password",
      "pin",
      "cvv",
      "verification code",
      "security code",
      "passcode",
    ];

    if (
      credentialWords.some((word) =>
        lower.includes(word)
      )
    ) {
      detectedThreats.push({
        title: "Credential request",
        detail: "Possible request for sensitive authentication information",
        severity: "HIGH",
      });
    }

    // Banking / financial context
    const financialWords = [
      "bank",
      "banking",
      "account",
      "transaction",
      "credit card",
      "debit card",
      "upi",
      "payment",
      "refund",
      "money",
    ];

    if (
      financialWords.some((word) =>
        lower.includes(word)
      )
    ) {
      detectedThreats.push({
        title: "Financial context",
        detail: "Conversation contains financial-related indicators",
        severity: "MEDIUM",
      });
    }

    // Urgency / pressure
    const urgencyWords = [
      "immediately",
      "urgent",
      "urgently",
      "right now",
      "act now",
      "hurry",
      "quickly",
      "as soon as possible",
      "within 5 minutes",
      "within 10 minutes",
      "don't wait",
    ];

    if (
      urgencyWords.some((word) =>
        lower.includes(word)
      )
    ) {
      detectedThreats.push({
        title: "Urgency / pressure",
        detail: "Language may be attempting to pressure the listener",
        severity: "MEDIUM",
      });
    }

    // Authority impersonation
    const authorityWords = [
      "bank officer",
      "bank employee",
      "police",
      "government",
      "government officer",
      "income tax",
      "cyber crime",
      "customer care",
      "support team",
      "official",
      "officer",
      "verification department",
    ];

    if (
      authorityWords.some((word) =>
        lower.includes(word)
      )
    ) {
      detectedThreats.push({
        title: "Authority impersonation",
        detail: "Speaker may be presenting themselves as an authority",
        severity: "HIGH",
      });
    }

    // Threat / consequence language
    const threatWords = [
      "account will be blocked",
      "account will be closed",
      "legal action",
      "arrest",
      "police case",
      "penalty",
      "fine",
      "blocked",
      "suspended",
      "lose your money",
    ];

    if (
      threatWords.some((word) =>
        lower.includes(word)
      )
    ) {
      detectedThreats.push({
        title: "Threat / consequence",
        detail: "Potential intimidation or fear-based manipulation",
        severity: "HIGH",
      });
    }

    /*
     * Remove duplicate threat categories.
     */
    const uniqueThreats = detectedThreats.filter(
      (threat, index, array) =>
        index ===
        array.findIndex(
          (item) =>
            item.title === threat.title
        )
    );

    setThreats(uniqueThreats);

    /*
     * Calculate overall risk.
     */
    const highCount = uniqueThreats.filter(
      (item) => item.severity === "HIGH"
    ).length;

    const mediumCount = uniqueThreats.filter(
      (item) => item.severity === "MEDIUM"
    ).length;

    if (highCount >= 2) {
      setRiskLevel("HIGH");
    } else if (highCount >= 1 && mediumCount >= 1) {
      setRiskLevel("HIGH");
    } else if (highCount >= 1) {
      setRiskLevel("MEDIUM");
    } else if (mediumCount >= 2) {
      setRiskLevel("MEDIUM");
    } else {
      setRiskLevel("LOW");
    }
  };


  /*
   * ==========================================
   * STOP MONITORING
   * ==========================================
   */

  const stopMonitoring = () => {
    if (animationRef.current) {
      cancelAnimationFrame(
        animationRef.current
      );

      animationRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.log(error);
      }

      recognitionRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current
        .getTracks()
        .forEach((track) => track.stop());

      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();

      audioContextRef.current = null;
    }

    analyserRef.current = null;

    barRefs.current.forEach((bar) => {
      if (bar) {
        bar.style.height = "18px";
      }
    });

    setListening(false);
    setVoiceDetected(false);
    setSignalLevel(0);
  };


  /*
   * ==========================================
   * SPEECH RECOGNITION
   * ==========================================
   */

  const startSpeechRecognition = () => {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    setSpeechSupported(true);

    const recognition =
      new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-IN";

    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";

      for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
      ) {
        const result = event.results[i];

        if (result.isFinal) {
          finalText +=
            result[0].transcript + " ";
        } else {
          interimText +=
            result[0].transcript;
        }
      }

      setTranscript((previous) => {
        const combined =
          previous +
          finalText;

        return combined
          .trim()
          .slice(-1200);
      });

      /*
       * Analyze both final and currently spoken
       * text so the UI feels responsive.
       */
      const textToAnalyze =
        `${transcript} ${finalText} ${interimText}`;

      analyzeSpeech(textToAnalyze);
    };

    recognition.onerror = (event) => {
      console.log(
        "Speech recognition error:",
        event.error
      );
    };

    recognition.onend = () => {
      /*
       * Chrome can stop recognition automatically.
       * Restart it while monitoring is active.
       */
      if (streamRef.current) {
        try {
          recognition.start();
        } catch (error) {
          console.log(error);
        }
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (error) {
      console.log(error);
    }
  };


  /*
   * ==========================================
   * START MONITORING
   * ==========================================
   */

  const startMonitoring = async () => {
    setMicError("");
    setTranscript("");
    setThreats([]);
    setRiskLevel("LOW");

    try {
      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        setMicError(
          "Microphone access is not supported by this browser."
        );

        return;
      }

      /*
       * Request microphone.
       */
      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

      streamRef.current = stream;

      /*
 * 3-second AI voice analysis.
 */
const recorder = new MediaRecorder(stream);

let audioChunks = [];

recorder.ondataavailable = (event) => {
  if (event.data && event.data.size > 0) {
    audioChunks.push(event.data);
  }
};

recorder.onstop = async () => {
  if (audioChunks.length === 0) {
    return;
  }

  const audioBlob = new Blob(audioChunks, {
    type: recorder.mimeType || "audio/webm",
  });

  audioChunks = [];

  setVoiceAnalyzing(true);

  try {
    const formData = new FormData();

    formData.append(
      "file",
      audioBlob,
      "voice.webm"
    );

    const response = await fetch(
      "http://127.0.0.1:8001/detect",
      {
        method: "POST",
        body: formData,
      }
    );
    const data = await response.json();
    setVoiceVerdict(data.verdict);
  setVoiceConfidence(data.confidence);

    if (!response.ok) {
      throw new Error(
        `Server error: ${response.status}`
      );
    }

    const result = await response.json();

    console.log("EchoShield AI result:", result);

    setVoiceVerdict(result.verdict);
    setVoiceConfidence(result.confidence);

  } catch (error) {
    console.error(
      "Voice analysis failed:",
      error
    );
  } finally {
    setVoiceAnalyzing(false);
  }

  /*
   * Start recording the next 3-second chunk.
   */
  if (streamRef.current) {
    recorder.start();
    
    setTimeout(() => {
      if (
        recorder.state === "recording"
      ) {
        recorder.stop();
      }
    }, 3000);
  }
};

recorder.start();

setTimeout(() => {
  if (recorder.state === "recording") {
    recorder.stop();
  }
}, 3000);

mediaRecorderRef.current = recorder;

      /*
       * Create audio analyser.
       */
      const AudioContext =
        window.AudioContext ||
        window.webkitAudioContext;

      const audioContext =
        new AudioContext();

      const analyser =
        audioContext.createAnalyser();

      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.75;

      const microphone =
        audioContext.createMediaStreamSource(
          stream
        );

      microphone.connect(analyser);

      audioContextRef.current =
        audioContext;

      analyserRef.current =
        analyser;

      setListening(true);

      /*
       * Start speech recognition.
       */
      startSpeechRecognition();

      /*
       * Live waveform.
       */
      const dataArray =
        new Uint8Array(
          analyser.fftSize
        );

      const animateWaveform = () => {
        if (!analyserRef.current) {
          return;
        }

        analyser.getByteTimeDomainData(
          dataArray
        );

        let sumSquares = 0;

        for (
          let i = 0;
          i < dataArray.length;
          i++
        ) {
          const normalized =
            (dataArray[i] - 128) /
            128;

          sumSquares +=
            normalized *
            normalized;
        }

        const rms = Math.sqrt(
          sumSquares /
            dataArray.length
        );

        const level = Math.min(
          100,
          Math.round(rms * 500)
        );

        setSignalLevel(level);

        const isVoiceActive =
          level > 8;

        setVoiceDetected(
          isVoiceActive
        );

        /*
         * Animate bars.
         */
        for (
          let i = 0;
          i < barCount;
          i++
        ) {
          const position =
            Math.floor(
              (i / barCount) *
                dataArray.length
            );

          const value =
            dataArray[position] ||
            128;

          const amplitude =
            Math.abs(
              value - 128
            );

          const height =
            Math.max(
              18,
              Math.min(
                82,
                18 +
                  amplitude *
                    3.5
              )
            );

          const bar =
            barRefs.current[i];

          if (bar) {
            bar.style.height =
              `${height}px`;
          }
        }

        animationRef.current =
          requestAnimationFrame(
            animateWaveform
          );
      };

      animateWaveform();

    } catch (error) {
      console.error(
        "Microphone error:",
        error
      );

      setListening(false);

      if (
        error.name ===
        "NotAllowedError"
      ) {
        setMicError(
          "Microphone permission was denied. Please allow microphone access."
        );
      } else {
        setMicError(
          "Unable to access the microphone. Check your browser settings."
        );
      }
    }
  };


  /*
   * ==========================================
   * TOGGLE
   * ==========================================
   */

  const toggleMonitoring = () => {
    if (listening) {
      stopMonitoring();
    } else {
      startMonitoring();
    }
  };


  /*
   * ==========================================
   * CLEANUP
   * ==========================================
   */

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(
          animationRef.current
        );
      }

      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (error) {
          console.log(error);
        }
      }

      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach((track) =>
            track.stop()
          );
      }

      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);


  /*
   * ==========================================
   * RISK COLOR / MESSAGE
   * ==========================================
   */

  const riskMessage =
  riskLevel === "HIGH"
    ? "Potential social-engineering attempt detected."
    : riskLevel === "MEDIUM"
    ? "Suspicious conversational indicators detected."
    : listening
    ? "Listening in real time."
    : "No significant threat indicators detected.";

  return (
    <div className="app">

      {/* ================= TOP BAR ================= */}

      <header className="topbar">

        <div className="brand">

          <div className="brand-mark">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </div>

          <div>

            <div className="brand-name">
              Echo<span>Shield</span>
            </div>

            <div className="brand-subtitle">
              REAL-TIME VOICE SECURITY
            </div>

          </div>

        </div>


        <div className="system-status">

          <span className="status-dot"></span>

          {listening
            ? "SYSTEM MONITORING"
            : "SYSTEM READY"}

        </div>

      </header>


      {/* ================= MAIN ================= */}

      <main className="dashboard">

        {/* ================= LEFT ================= */}

        <section className="hero">

          <div className="eyebrow">
            <span></span>
            VOICE THREAT MONITOR
          </div>


          <h1>
            Listen.
            <br />
            <span>Detect.</span> Protect.
          </h1>


          <p className="hero-description">
            EchoShield continuously analyses
            voice interactions for indicators of
            manipulation, impersonation and
            social-engineering risk.
          </p>


          {/* ================= MONITOR CARD ================= */}

          <div className="monitor-card">

            <div className="monitor-header">

              <div>

                <p className="monitor-label">
                  MICROPHONE INPUT
                </p>

                <h2>

                  {listening 
                      ? "Listening in real time"
                    : "Monitoring inactive"}

                </h2>

              </div>


              <div
                className={`mic-state ${
                  listening
                    ? "active"
                    : ""
                }`}
              >

                <span></span>

                {listening
                  ? "LIVE"
                  : "STANDBY"}

              </div>

            </div>


            {/* WAVEFORM */}

            <div
              className={`waveform ${
                listening
                  ? "wave-active"
                  : ""
              }`}
            >

              {Array.from({
                length: barCount,
              }).map(
                (_, index) => (

                  <div
                    key={index}
                    ref={(element) => {
                      barRefs.current[
                        index
                      ] = element;
                    }}
                    className="wave-bar"
                    style={{
                      height:
                        "18px",
                    }}
                  ></div>

                )
              )}

            </div>


            {/* SIGNAL */}

            <div className="signal-meter">

              <div className="signal-label">

                <span>
                  SIGNAL LEVEL
                </span>

                <strong>
                  {listening
                    ? `${signalLevel}%`
                    : "0%"}
                </strong>

              </div>


              <div className="signal-track">

                <div
                  className="signal-fill"
                  style={{
                    width:
                      `${signalLevel}%`,
                  }}
                ></div>

              </div>

            </div>


            {/* ERROR */}

            {micError && (
              <div className="mic-error">
                {micError}
              </div>
            )}


            {/* TRANSCRIPT */}

            {listening && (
              <div className="transcript-box">

                <div className="transcript-heading">
                  <span></span>
                  LIVE TRANSCRIPT
                </div>

                <p>
                  {transcript ||
                    "Listening for speech..."}
                </p>

              </div>
            )}


            {/* FOOTER */}

            <div className="monitor-footer">

              <div className="input-info">

                <span>
                  INPUT
                </span>

                <strong>
                  System Microphone
                </strong>

              </div>


              <button
                className={`listen-button ${
                  listening
                    ? "stop"
                    : ""
                }`}
                onClick={
                  toggleMonitoring
                }
              >

                <span className="button-icon">
                  {listening
                    ? "■"
                    : "●"}
                </span>

                {listening
                  ? "Stop monitoring"
                  : "Start monitoring"}

              </button>

            </div>

          </div>

        </section>


        {/* ================= RIGHT ================= */}

        <aside className="side-panel">


          {/* ================= RISK ================= */}

          <div
            className={`risk-card risk-${riskLevel.toLowerCase()}`}
          >

            <div className="card-heading">

              <span>
                01
              </span>

              CURRENT RISK

            </div>


            <div className="risk-display">

              <div className="risk-ring">

                <div>

                  <strong>
                    {riskLevel}
                  </strong>

                  <small>
                    RISK
                  </small>

                </div>

              </div>


              <p>
                {riskMessage}
              </p>

            </div>

          </div>


          {/* ================= ANALYSIS ================= */}

          <div className="analysis-card">

            <div className="card-heading">

              <span>
                02
              </span>

              ANALYSIS ENGINE

            </div>


            {/* VOICE */}

            <div className="analysis-row">

              <div>

                <strong>
                  Voice activity
                </strong>

               <small>
                 {voiceVerdict
                   ? `${voiceVerdict} • ${voiceConfidence}% confidence`
                   : listening
                       ? "Listening for signal"
                     : "Signal inactive"}
               </small>
              </div>


              <span
                className={
                  listening &&
                  voiceDetected
                    ? "check"
                    : "pending"
                }
              >
                {listening &&
                voiceDetected
                  ? "✓"
                  : "—"}
              </span>

            </div>


            {/* SPEECH */}

            <div className="analysis-row">

              <div>

                <strong>
                  Speech patterns
                </strong>

                <small>

                  {listening
                    ? transcript
                      ? "Speech analyzed"
                      : "Awaiting speech"
                    : "Analysis inactive"}

                </small>

              </div>


              <span
                className={
                  transcript
                    ? "check"
                    : "pending"
                }
              >

                {transcript
                  ? "✓"
                  : "—"}

              </span>

            </div>


            {/* CONTEXT */}

            <div className="analysis-row">

              <div>

                <strong>
                  Context signals
                </strong>

                <small>

                  {threats.length > 0
                    ? `${threats.length} indicator${
                        threats.length > 1
                          ? "s"
                          : ""
                      } detected`
                    : listening
                    ? "Analyzing"
                    : "Risk assessment"}

                </small>

              </div>


              <span
                className={
                  threats.length > 0
                    ? "threat-indicator"
                    : listening
                    ? "analysis-active"
                    : "pending"
                }
              >

                {threats.length > 0
                  ? "!"
                  : listening
                  ? "●"
                  : "—"}

              </span>

            </div>

          </div>


          {/* ================= THREAT INDICATORS ================= */}

          {threats.length > 0 && (

            <div className="threat-card">

              <div className="threat-card-heading">

                <span>
                  03
                </span>

                THREAT INDICATORS

              </div>


              {threats.map(
                (threat, index) => (

                  <div
                    className="threat-row"
                    key={index}
                  >

                    <div className="threat-icon">
                      !
                    </div>

                    <div>

                      <strong>
                        {threat.title}
                      </strong>

                      <small>
                        {threat.detail}
                      </small>

                    </div>

                  </div>

                )
              )}

            </div>

          )}

        </aside>

      </main>


      {/* ================= BOTTOM ================= */}

      <footer className="bottom-bar">

        <div>

          <span className="blue-line"></span>

          <span>
            ECHOSHIELD SECURITY LAYER
          </span>

        </div>


        <div className="footer-note">

          PRIVACY-FIRST • REAL-TIME • ADAPTIVE

        </div>

      </footer>

    </div>
  );
}

export default App;