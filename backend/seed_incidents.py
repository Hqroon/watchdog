"""
Seed the running Lance backend with 20 fake incidents for UI testing.
Run while the backend is up:  python seed_incidents.py
"""
import time
import random
import httpx

BASE = "http://localhost:8000"

SAMPLES = [
    ("high",   "PPE",          "Worker is not wearing a hard hat in a mandatory zone.",
     "Put on your hard hat immediately before continuing — your safety is the priority."),
    ("high",   "PPE",          "High-visibility vest is missing on the shop floor.",
     "Please grab a hi-vis vest from the PPE station near the entrance before proceeding."),
    ("medium", "posture",      "Worker is hunching over the workbench with a bent back.",
     "Try adjusting the bench height and roll your shoulders back — small changes make a big difference over time."),
    ("medium", "posture",      "Awkward neck angle detected while inspecting components.",
     "Reposition the work item to eye level to keep your neck in a neutral position."),
    ("low",    "housekeeping", "Loose cable visible across the walkway.",
     "Let's tidy that cable away from the walkway to keep everyone safe — a quick fix!"),
    ("medium", "housekeeping", "Debris and offcuts accumulated near the machine base.",
     "Please clear the debris before the next shift — a clean workspace is a safe workspace."),
    ("high",   "proximity",    "Worker standing within 0.5 m of active rotating machinery.",
     "Please step back to at least 1 metre from the machine — getting too close is very dangerous."),
    ("medium", "proximity",    "Two workers converging too close to forklift path.",
     "Use the designated pedestrian lane and make eye contact with the forklift operator before crossing."),
    ("low",    "tool_use",     "Screwdriver left on top of electrical panel.",
     "Remember to return tools to their storage spot after use — it helps everyone stay safe!"),
    ("medium", "tool_use",     "Worker using a wrench without proper grip posture.",
     "Try adjusting your grip to reduce wrist strain — your joints will thank you later!"),
    ("high",   "PPE",          "Safety goggles removed during grinding operation.",
     "Please replace your goggles straight away — eye protection is non-negotiable during grinding."),
    ("low",    "housekeeping", "Oil spill near workstation not marked or cleaned.",
     "Could you place a wet-floor sign and clean up the spill? It only takes a moment and prevents a fall."),
    ("medium", "posture",      "Repeated overhead reaching detected during assembly.",
     "A step platform could save you a lot of strain — try repositioning components within shoulder height."),
    ("high",   "proximity",    "Worker leaning over unguarded conveyor belt.",
     "Please step back immediately and report the missing guard to maintenance before resuming work."),
    ("low",    "PPE",          "Ear defenders not worn in the high-noise zone.",
     "Pop your ear defenders on — prolonged exposure above 85 dB can cause lasting damage."),
    ("medium", "tool_use",     "Impact wrench operated without anti-vibration gloves.",
     "Vibration-dampening gloves are available at the tool station — they really reduce hand-arm strain."),
    ("low",    "housekeeping", "Cardboard boxes obstructing the emergency exit path.",
     "Please move those boxes to a designated storage area — exits must stay clear at all times."),
    ("high",   "PPE",          "Face shield absent during chemical handling task.",
     "Stop the task and fit your face shield before continuing — check the SDS for full PPE requirements."),
    ("medium", "proximity",    "Maintenance personnel working too close to live electrical panel.",
     "Please establish an exclusion zone and apply lockout/tagout before working near live equipment."),
    ("low",    "posture",      "Worker sitting without lumbar support for an extended period.",
     "Adjust your chair's lumbar support and consider a short standing break — your back will feel much better."),
]


def seed():
    now = time.time()
    print(f"Seeding {len(SAMPLES)} incidents into {BASE}…\n")
    created = 0
    for i, (sev, cat, desc, coach) in enumerate(SAMPLES):
        ts = now - (len(SAMPLES) - i) * 180   # spread over last ~hour
        payload = {
            "timestamp": ts,
            "severity": sev,
            "category": cat,
            "description": desc,
            "coach_message": coach,
            "resolved": random.random() < 0.25,
        }
        try:
            r = httpx.post(f"{BASE}/incidents/seed", json=payload, timeout=5)
            r.raise_for_status()
            created += 1
            print(f"  [{sev:6}] {cat:12} — {desc[:55]}")
        except Exception as exc:
            print(f"  ERROR: {exc}")

    print(f"\nDone: {created}/{len(SAMPLES)} incidents seeded. Refresh the browser dashboard.")


if __name__ == "__main__":
    seed()
