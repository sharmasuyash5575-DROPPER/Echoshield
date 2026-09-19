from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from transformers import pipeline
from pydub import AudioSegment
import tempfile
import os

app = FastAPI(title="EchoShield AI Voice Detector")

# Allow the React frontend to communicate with the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

print("Loading EchoShield AI voice detector...")

# Pretrained audio deepfake detector
detector = pipeline(
    "audio-classification",
    model="Hemgg/Deepfake-audio-detection"
)

print("AI voice detector loaded successfully.")


@app.get("/")
def root():
    return {
        "status": "online",
        "service": "EchoShield AI Voice Detector"
    }


@app.post("/detect")
async def detect_voice(file: UploadFile = File(...)):

    input_path = None
    wav_path = None

    try:
        # Save uploaded WebM/audio file temporarily
        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=".webm"
        ) as temp:
            input_path = temp.name
            temp.write(await file.read())

        # Convert WebM -> WAV
        wav_path = input_path.replace(".webm", ".wav")

        audio = AudioSegment.from_file(input_path)

        # Convert to mono, 16 kHz
        audio = audio.set_channels(1)
        audio = audio.set_frame_rate(16000)

        audio.export(wav_path, format="wav")

        # --------------------------------------------------
        # NO VOICE DETECTION
        # --------------------------------------------------
        # Check whether the recorded audio is basically silent
        # before sending it to the AI detector.

        if audio.dBFS == float("-inf") or audio.dBFS < -45:
            return {
                "status": "success",
                "verdict": "NO VOICE DETECTED",
                "is_fake": None,
                "confidence": 0,
                "raw_results": []
            }

        # Run AI detection on normalized WAV
        results = detector(wav_path)

        # Sort highest probability first
        results = sorted(
            results,
            key=lambda x: x["score"],
            reverse=True
        )

        top = results[0]

        label = top["label"].lower()
        confidence = round(top["score"] * 100, 2)

        # --------------------------------------------------
        # KEEPING YOUR EXISTING AI / HUMAN MAPPING
        # --------------------------------------------------

        if label == "humanvoice":
            verdict = "AI GENERATED VOICE"
            is_fake = False

        elif label == "aivoice":
            verdict = "HUMAN VOICE"
            is_fake = True

        else:
            verdict = "UNKNOWN"
            is_fake = None

        return {
            "status": "success",
            "verdict": verdict,
            "is_fake": is_fake,
            "confidence": confidence,
            "raw_results": results
        }

    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }

    finally:
        # Delete temporary files
        if input_path and os.path.exists(input_path):
            os.remove(input_path)

        if wav_path and os.path.exists(wav_path):
            os.remove(wav_path)