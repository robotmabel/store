"""
catalog.py — the single source of truth for every SKU in the store.

Nothing about a product is typed twice. `tools/build.py` reads this file and
emits the product JSON the site loads, the Shopify import CSV, the sitemap and
one SVG figure per SKU.

PRICES.  Retail is *derived*, never typed: every line carries what the part
actually costs landed in Toronto, and a per-category margin turns that into a
shelf price. Change MARGINS or a cost and the whole catalogue re-prices. Costs
tagged `bom` came from MABEL's own bill of materials (BOM/data/*.csv, priced
31 July 2026); `vendor` is the published list price; `estimate` is a Toronto
landed-cost estimate that still needs a real quote.

SPECS.  `src` on every product records where its numbers came from, with the
same three values. `build.py` refuses to ship a product with no specs and
prints a provenance table so the unverified lines stay visible.
"""

CNY_USD = 0.1434224      # BOM/generated/bom_summary.json, 31 July 2026
USD_CAD = 1.37           # documented, refreshed at build time by hand

# Gross margin by category. Commodity hardware carries the most, brand-name
# compute and sensors the least — we are a reseller there, not a maker.
MARGINS = {
    "actuators": 1.30, "wheels": 1.32, "hardware": 1.42, "electronics": 1.38,
    "sensors": 1.20, "compute": 1.14, "tools": 1.30, "robots": 1.00,
}

# Every part in this catalogue was bought for the MABEL build. What is on the
# shelf is what is left over: spares held against failures, the remainder of a
# minimum order quantity, and parts from options we tried and did not keep.
# That framing appears on the site verbatim — it is the honest description of
# the stock and it sets expectations about quantity and re-supply.
SURPLUS_NOTE = (
    "Surplus from our own MABEL build \u2014 unused, in original packaging, "
    "in the quantity shown."
)

CATEGORIES = [
    ("actuators",   "Actuators",  "Joint modules, bus servos, steppers and gearboxes.",
     "Every axis on a research robot starts here. MIT-mode joint modules with dual encoders, "
     "TTL bus servos for tendon-driven hands, and closed-loop steppers with field-oriented control."),
    ("wheels",      "Wheels",     "Swerve modules, omni and mecanum wheels, hub drives.",
     "Holonomic mobility, assembled and tested. Complete swerve modules, the motors and encoders "
     "inside them, and every wheel type a mobile base can stand on."),
    ("hardware",    "Hardware",   "Fasteners, bearings, extrusion, machined structure.",
     "The metal in between. Sorted fastener sets, T-slot extrusion cut to length, bearings, "
     "and the laser-cut and CNC structural parts for MABEL, OpenArm and ORCA."),
    ("electronics", "Electronics","CAN adapters, power distribution, harnesses.",
     "Buses, power and wire. USB-CAN adapters, distribution boards, fused power paths, "
     "connector kits and the pre-made harnesses that save an evening per arm."),
    ("sensors",     "Sensors",    "Depth cameras, wrist cams, lidar, IMU, tactile.",
     "How the robot sees and feels. Global-shutter wrist cameras, stereo depth, "
     "scanning lidar, and the IMUs and force sensors that close the loop."),
    ("compute",     "Compute",    "Jetson, carriers, storage, workstations.",
     "Where the policy runs. Jetson modules and carriers sized to real memory budgets, "
     "plus the storage and desktop hardware for training."),
    ("tools",       "Tools",      "Precision drivers, crimpers, measurement.",
     "Build tools chosen for one job: assembling small, dense robots without stripping anything."),
    ("robots",      "Robots",     "MABEL, complete.",
     "A mobile bimanual research platform, as a kit you build or a robot that arrives working."),
]


def nice(x: float) -> float:
    """Apple-style shelf prices: 8.99, 29, 249, 1099. Never 251.37."""
    if x < 20:
        return round(x) - 0.01 if x >= 3 else round(x * 2) / 2
    if x < 100:
        return float(int((x + 4) / 5) * 5 - 1)
    if x < 1000:
        return float(int((x + 9) / 10) * 10 - 1)
    return float(int((x + 99) / 100) * 100 - 1)


P = []          # every product, in display order


def add(**k):
    """Register one SKU. cost_cny or cost_usd in, retail price out."""
    cat = k["cat"]
    if "cost_cny" in k:
        cost = k.pop("cost_cny") * CNY_USD
    else:
        cost = k.pop("cost_usd")
    k["cost_usd"] = round(cost, 2)
    k["price"] = k.get("price") or nice(cost * MARGINS[cat])
    k.setdefault("art", {})
    k.setdefault("stock", "in-stock")
    k.setdefault("tags", [])
    k.setdefault("badge", "")
    P.append(k)
    return k


def S(*groups):
    """Spec groups: S(("Performance", [("Rated torque","9 N·m"), ...]), ...)"""
    return [{"group": g, "rows": [{"k": a, "v": b} for a, b in rows]} for g, rows in groups]


# ================================================================= ACTUATORS ==
add(id="damiao-dm-j4310", sku="MR-ACT-4310", cat="actuators", brand="DAMIAO",
    name="DAMIAO DM-J4310-2EC", tagline="10:1 MIT-mode joint module with dual encoders",
    cost_cny=599, cost_src="bom", src="vendor", family="joint_module",
    art={"body": "anod_black", "accent": "anod_red", "d": 360, "h": 240},
    badge="In MABEL", tags=["mabel", "arm", "neck", "can", "mit-mode"],
    summary="The workhorse of a lightweight research arm. A 4310-frame BLDC with an integrated "
            "FOC driver, a 10:1 planetary stage and encoders on both the rotor and the output, so "
            "the controller knows where the joint is even after the gearbox winds up.",
    highlights=["Dual encoder — rotor and output, so backlash is observed, not assumed",
                "MIT impedance mode: position, velocity, kp, kd and feed-forward torque in one frame",
                "Driver integrated into the housing — CAN in, torque out, no external ESC",
                "Six of these sit in every MABEL arm pair"],
    specs=S(("Performance", [("Rated torque", "3.5 N·m"), ("Peak torque", "10 N·m"),
                             ("Reduction", "10:1 planetary"), ("Max speed", "30 rad/s"),
                             ("Rated voltage", "24 V DC")]),
            ("Feedback & control", [("Encoders", "Dual — rotor + output, magnetic"),
                                    ("Resolution", "14-bit per encoder"),
                                    ("Control modes", "MIT impedance · position · velocity · torque"),
                                    ("Bus", "CAN 2.0A, up to 1 Mbit/s"),
                                    ("Loop rate", "Up to 1 kHz per joint")]),
            ("Physical", [("Mass", "300 g"), ("Outer diameter", "43 mm"),
                          ("Output", "Bolt-circle flange, 6 × M3"),
                          ("Connector", "4-pin power + CAN pigtail")])))

add(id="damiao-dm4340", sku="MR-ACT-4340", cat="actuators", brand="DAMIAO",
    name="DAMIAO DM4340", tagline="9 N·m geared joint motor, dual encoder",
    cost_cny=882.33, cost_src="bom", src="bom", family="joint_module",
    art={"body": "anod_black", "accent": "anod_red", "d": 390, "h": 250},
    badge="In MABEL", tags=["mabel", "arm", "can", "mit-mode"],
    summary="A step up in torque for shoulder roll and elbow. Same integrated-driver architecture "
            "as the 4310, same CAN protocol, roughly three times the continuous torque.",
    highlights=["9 N·m rated — sized for shoulder roll and elbow on a 7-DOF arm",
                "Drop-in protocol compatibility with the rest of the DAMIAO line",
                "Dual encoder for output-side position truth",
                "Four per MABEL, two per arm"],
    specs=S(("Performance", [("Rated torque", "9 N·m"), ("Peak torque", "27 N·m"),
                             ("Reduction", "Integrated planetary"), ("Rated voltage", "24 V DC")]),
            ("Feedback & control", [("Encoders", "Dual — rotor + output"),
                                    ("Control modes", "MIT impedance · position · velocity · torque"),
                                    ("Bus", "CAN 2.0A, up to 1 Mbit/s")]),
            ("Physical", [("Frame", "43 mm class"), ("Output", "Flanged, bolt circle"),
                          ("Connector", "Power + CAN pigtail")])))

add(id="damiao-dm8009p", sku="MR-ACT-8009", cat="actuators", brand="DAMIAO",
    name="DAMIAO DM8009P", tagline="40 N·m joint module, V4",
    cost_cny=1899, cost_src="bom", src="bom", family="joint_module",
    art={"body": "anod_black", "accent": "anod_red", "d": 440, "h": 260, "bolts": 8},
    badge="In MABEL", tags=["mabel", "arm", "shoulder", "can", "mit-mode"],
    summary="The shoulder joint. Where a 4310 runs out of authority — carrying a whole arm at "
            "full extension — the 8009P takes over with four times the torque in an 80 mm frame.",
    highlights=["40 N·m — holds a loaded arm horizontal without creeping",
                "V4 hardware with the integrated driver and dual encoders",
                "Shoulder pitch and yaw on both MABEL arms use this module",
                "Same CAN frame format as every other DAMIAO joint"],
    specs=S(("Performance", [("Peak torque", "40 N·m"), ("Reduction", "Integrated planetary"),
                             ("Rated voltage", "24 V DC"), ("Hardware revision", "V4")]),
            ("Feedback & control", [("Encoders", "Dual — rotor + output"),
                                    ("Control modes", "MIT impedance · position · velocity · torque"),
                                    ("Bus", "CAN 2.0A, up to 1 Mbit/s")]),
            ("Physical", [("Frame", "80 mm class"), ("Output", "Flanged, bolt circle"),
                          ("Connector", "Power + CAN pigtail")])))

add(id="damiao-dm10422p", sku="MR-ACT-10422", cat="actuators", brand="DAMIAO",
    name="DAMIAO DM10422P", tagline="400 N·m hollow-shaft torso actuator",
    cost_cny=1999, cost_src="bom", src="bom", family="harmonic_joint",
    art={"body": "anod_black", "d": 470, "h": 190},
    badge="In MABEL", tags=["mabel", "torso", "can", "hollow-shaft"],
    summary="A torso-scale joint. Hollow-shaft planetary reduction with dual inductive encoders — "
            "the bore lets the arm and head harness pass straight through the joint instead of "
            "looping around it.",
    highlights=["400 N·m — tilts an entire upper body under load",
                "Hollow shaft: route power and CAN through the axis of rotation",
                "Dual inductive encoders, immune to the magnetic clutter of a motor housing",
                "MABEL's torso-pitch joint"],
    specs=S(("Performance", [("Rated torque", "400 N·m"), ("Reduction", "Hollow-shaft planetary"),
                             ("Rated voltage", "24–48 V DC")]),
            ("Feedback & control", [("Encoders", "Dual inductive, high precision"),
                                    ("Control modes", "Position · velocity · torque"),
                                    ("Bus", "CAN 2.0A")]),
            ("Physical", [("Through bore", "Hollow shaft for harness pass-through"),
                          ("Output", "Large-diameter bolt circle")])))

add(id="unitree-go-m8010-6", sku="MR-ACT-GO8010", cat="actuators", brand="Unitree",
    name="Unitree GO-M8010-6", tagline="Quasi-direct-drive joint motor, 23.7 N·m peak",
    cost_usd=118, cost_src="vendor", src="vendor", family="pancake",
    art={"body": "alu_dark", "d": 400, "h": 130},
    tags=["legged", "qdd", "rs485"],
    summary="The motor that made low-cost legged robots possible. A 6.33:1 planetary stage keeps "
            "the reflected inertia low enough for genuine torque control, so the leg feels the "
            "ground rather than fighting it.",
    highlights=["Quasi-direct drive — low gearing, high backdrivability",
                "23.7 N·m peak from a 485 g package",
                "RS-485 daisy chain, up to 15 motors on one bus",
                "The standard actuator for quadruped and low-cost humanoid legs"],
    specs=S(("Performance", [("Peak torque", "23.7 N·m"), ("Reduction", "6.33:1 planetary"),
                             ("Max speed", "33.5 rad/s"), ("Rated voltage", "24 V DC")]),
            ("Feedback & control", [("Encoder", "15-bit absolute, rotor side"),
                                    ("Control", "Position · velocity · torque, with kp/kd"),
                                    ("Bus", "RS-485, 4 Mbit/s")]),
            ("Physical", [("Mass", "485 g"), ("Outer diameter", "80 mm"),
                          ("Output", "Keyed shaft with pulley flange")])))

add(id="unitree-a1", sku="MR-ACT-A1", cat="actuators", brand="Unitree",
    name="Unitree A1 Motor", tagline="33.5 N·m high-torque joint motor",
    cost_usd=232, cost_src="vendor", src="vendor", family="pancake",
    art={"body": "alu_dark", "d": 430, "h": 150},
    tags=["legged", "qdd", "rs485"],
    summary="The larger sibling. Same quasi-direct-drive philosophy, more frame, more torque — "
            "for hips, knees and anything carrying the mass of a whole robot.",
    highlights=["33.5 N·m peak torque", "9.1:1 planetary reduction",
                "Fully backdrivable — safe for contact-rich work",
                "RS-485 with the same protocol as the GO series"],
    specs=S(("Performance", [("Peak torque", "33.5 N·m"), ("Reduction", "9.1:1 planetary"),
                             ("Max speed", "21 rad/s"), ("Rated voltage", "24 V DC")]),
            ("Feedback & control", [("Encoder", "15-bit absolute"),
                                    ("Control", "Position · velocity · torque"),
                                    ("Bus", "RS-485")]),
            ("Physical", [("Mass", "605 g"), ("Outer diameter", "88 mm")])))

add(id="xiaomi-cybergear-rs01", sku="MR-ACT-RS01", cat="actuators", brand="Xiaomi",
    name="Xiaomi CyberGear RS-01", tagline="Micro joint actuator, 12 N·m peak",
    cost_usd=96, cost_src="vendor", src="vendor", family="micro_motor",
    art={"body": "plastic_wh", "d": 340, "h": 200},
    tags=["compact", "can", "mit-mode"],
    summary="Xiaomi's micro-motor, sold openly and documented well. A 7.75:1 planetary stage, an "
            "integrated driver and a genuine impedance mode in a package small enough for a wrist.",
    highlights=["12 N·m peak from a 317 g motor",
                "Impedance, position, velocity and current modes over CAN",
                "Published protocol and a maintained SDK",
                "A clean entry point for small arms and grippers"],
    specs=S(("Performance", [("Rated torque", "4 N·m"), ("Peak torque", "12 N·m"),
                             ("Reduction", "7.75:1 planetary"), ("Max speed", "297 rpm"),
                             ("Rated voltage", "24 V DC")]),
            ("Feedback & control", [("Encoder", "14-bit magnetic"),
                                    ("Control modes", "Impedance · position · velocity · current"),
                                    ("Bus", "CAN 2.0, 1 Mbit/s")]),
            ("Physical", [("Mass", "317 g"), ("Outer diameter", "60 mm")])))

add(id="xiaomi-cybergear-rs03", sku="MR-ACT-RS03", cat="actuators", brand="Xiaomi",
    name="Xiaomi CyberGear RS-03", tagline="High-torque CyberGear, 60 N·m peak",
    cost_usd=268, cost_src="estimate", src="estimate", family="micro_motor",
    art={"body": "plastic_wh", "d": 400, "h": 230},
    tags=["can", "mit-mode"],
    summary="The high-torque CyberGear. Same protocol and tooling as the RS-01, scaled up for "
            "hips, shoulders and anything that has to hold a load statically.",
    highlights=["60 N·m peak torque", "Shares the RS-01 CAN protocol and SDK",
                "Integrated driver — no external ESC",
                "For legs, shoulders and torso joints"],
    specs=S(("Performance", [("Peak torque", "60 N·m"), ("Reduction", "Integrated planetary"),
                             ("Rated voltage", "48 V DC")]),
            ("Feedback & control", [("Encoder", "Magnetic absolute"),
                                    ("Control modes", "Impedance · position · velocity · current"),
                                    ("Bus", "CAN 2.0")]),
            ("Physical", [("Frame", "90 mm class")])))

add(id="eyou-phu17h-80", sku="MR-ACT-PHU17", cat="actuators", brand="EYou",
    name="EYou PHU17H-80", tagline="Size-17 harmonic joint, 101:1, CANopen",
    cost_usd=880, cost_src="estimate", src="estimate", family="harmonic_joint",
    art={"body": "anod_black", "d": 450, "h": 175},
    tags=["harmonic", "canopen", "zero-backlash", "cinema"],
    summary="A harmonic-drive joint for work where backlash is not negotiable — camera motion, "
            "metrology, any arm whose repeatability is the specification. Strain-wave reduction "
            "means near-zero backlash and a hollow bore straight through the axis.",
    highlights=["Strain-wave (harmonic) reduction — near-zero backlash",
                "101:1 in a single stage",
                "CANopen CiA 402, so it drops into an existing motion stack",
                "Hollow bore for through-axis cable routing"],
    specs=S(("Performance", [("Reduction", "101:1 strain wave"),
                             ("Backlash", "Near zero, by construction"),
                             ("Rated voltage", "48 V DC")]),
            ("Feedback & control", [("Encoders", "Dual — motor + output"),
                                    ("Protocol", "CANopen, CiA 402 profile"),
                                    ("Default node ID", "1 (configurable, object 0x26A0)")]),
            ("Physical", [("Frame size", "17"), ("Through bore", "Hollow output shaft")])))

add(id="eyou-phu20h-100", sku="MR-ACT-PHU20", cat="actuators", brand="EYou",
    name="EYou PHU20H-100", tagline="Size-20 harmonic joint, 100:1, CANopen",
    cost_usd=1120, cost_src="estimate", src="estimate", family="harmonic_joint",
    art={"body": "anod_black", "d": 490, "h": 195},
    tags=["harmonic", "canopen", "zero-backlash", "cinema"],
    summary="One frame size up from the PHU17H. For the proximal joints of a long-reach arm, "
            "where the joint carries every link outboard of it.",
    highlights=["Larger frame for base and shoulder joints",
                "100:1 strain-wave reduction, near-zero backlash",
                "CANopen CiA 402", "Hollow output shaft"],
    specs=S(("Performance", [("Reduction", "100:1 strain wave"), ("Backlash", "Near zero"),
                             ("Rated voltage", "48 V DC")]),
            ("Feedback & control", [("Encoders", "Dual — motor + output"),
                                    ("Protocol", "CANopen, CiA 402 profile")]),
            ("Physical", [("Frame size", "20"), ("Through bore", "Hollow output shaft")])))

add(id="feetech-hl3915m", sku="MR-ACT-3915", cat="actuators", brand="Feetech",
    name="Feetech HL3915M", tagline="14 kg·cm dual-shaft bus servo, steel gears",
    cost_cny=235, cost_src="bom", src="bom", family="bus_servo",
    art={"body": "anod_grey", "w": 300, "h": 420, "label": "HL3915M"},
    badge="In MABEL", tags=["mabel", "orca", "hand", "ttl", "force-control"],
    summary="The finger servo. Sixteen of these drive one ORCA hand — dual-shaft so the output "
            "is supported on both sides, steel gears because a tendon-driven finger stalls often.",
    highlights=["Dual output shafts — the finger pivot is supported at both ends",
                "Full steel gear train, rated for repeated stall",
                "1 Mbit TTL bus: 16 servos share four wires",
                "Position, speed and load readback on every servo"],
    specs=S(("Performance", [("Stall torque", "14 kg·cm at 12 V"),
                             ("Operating voltage", "9–14.8 V DC"),
                             ("Gear train", "Full steel")]),
            ("Feedback & control", [("Bus", "TTL half-duplex, up to 1 Mbit/s"),
                                    ("Feedback", "Position, speed, load, voltage, temperature"),
                                    ("Addressing", "1–253 on one chain"),
                                    ("Part number", "HL-3915-C001")]),
            ("Physical", [("Output", "Dual shaft"), ("Connector", "3-pin, daisy-chainable")])))

add(id="feetech-hl3930m", sku="MR-ACT-3930", cat="actuators", brand="Feetech",
    name="Feetech HL3930M", tagline="35 kg·cm dual-shaft bus servo, metal case",
    cost_cny=359, cost_src="bom", src="bom", family="bus_servo",
    art={"body": "alu_dark", "w": 320, "h": 440, "label": "HL3930M"},
    badge="In MABEL", tags=["mabel", "orca", "hand", "wrist", "ttl"],
    summary="The wrist servo of an ORCA hand. Metal case, two and a half times the torque of the "
            "finger servo, on the same TTL bus and in the same control API.",
    highlights=["35 kg·cm — rotates a loaded hand", "Metal case, better heat path under sustained load",
                "Same 1 Mbit TTL bus as the HL3915M", "One per hand"],
    specs=S(("Performance", [("Stall torque", "35 kg·cm at 12 V"),
                             ("Operating voltage", "9–14.8 V DC"),
                             ("Case", "Metal")]),
            ("Feedback & control", [("Bus", "TTL half-duplex, up to 1 Mbit/s"),
                                    ("Feedback", "Position, speed, load, voltage, temperature"),
                                    ("Part number", "HL-3930-C001")]),
            ("Physical", [("Output", "Dual shaft"), ("Connector", "3-pin, daisy-chainable")])))

add(id="feetech-sts3215", sku="MR-ACT-3215", cat="actuators", brand="Feetech",
    name="Feetech STS3215", tagline="30 kg·cm magnetic-encoder bus servo",
    cost_usd=15.5, cost_src="vendor", src="vendor", family="bus_servo",
    art={"body": "anod_black", "w": 290, "h": 400, "label": "STS3215"},
    tags=["ttl", "budget", "teleop"],
    summary="The servo behind most low-cost teleoperation arms. A magnetic encoder on the output "
            "gives it absolute position, which is what makes leader-follower arms practical.",
    highlights=["Magnetic absolute encoder — knows its angle at power-on",
                "30 kg·cm at 12 V", "1 Mbit TTL bus, chainable",
                "The standard actuator for leader-follower teleop rigs"],
    specs=S(("Performance", [("Stall torque", "30 kg·cm at 12 V"),
                             ("Operating voltage", "6–12.6 V DC"),
                             ("Gear train", "Metal")]),
            ("Feedback & control", [("Encoder", "12-bit magnetic, absolute"),
                                    ("Bus", "TTL half-duplex, up to 1 Mbit/s"),
                                    ("Feedback", "Position, speed, load, temperature")]),
            ("Physical", [("Rotation", "360° continuous or 0–360° position")])))

add(id="dynamixel-xc330", sku="MR-ACT-XC330", cat="actuators", brand="Robotis",
    name="Dynamixel XC330-T181-T", tagline="Smart servo, 181:1, TTL",
    cost_usd=103.39, cost_src="vendor", src="vendor", family="bus_servo",
    art={"body": "plastic_bk", "w": 270, "h": 380, "label": "XC330"},
    badge="In MABEL", tags=["mabel", "neck", "head", "ttl"],
    summary="A small, precise smart servo with a real control table — current-based position "
            "control, PID gains you can tune live, and status you can trust. MABEL's neck.",
    highlights=["181:1 gearing in a 23 g-class housing",
                "Current-based position control for compliant head motion",
                "Full control table over TTL", "Two drive MABEL's neck pitch and roll"],
    specs=S(("Performance", [("Stall torque", "0.92 N·m at 12 V"), ("Reduction", "181:1"),
                             ("No-load speed", "81 rpm at 12 V"),
                             ("Operating voltage", "5–12 V DC")]),
            ("Feedback & control", [("Encoder", "12-bit magnetic contactless"),
                                    ("Control modes", "Current · velocity · position · extended position · PWM"),
                                    ("Bus", "TTL, up to 4.5 Mbit/s"), ("Model number", "1190")]),
            ("Physical", [("Mass", "23 g"), ("Case", "Engineering plastic")])))

add(id="nema17-foc", sku="MR-ACT-N17FOC", cat="actuators", brand="MABEL Robotics",
    name="NEMA 17 Closed-Loop Stepper", tagline="Stepper + FOC driver, 0.45 N·m",
    cost_usd=34, cost_src="estimate", src="estimate", family="stepper",
    art={"body": "anod_black", "s": 330, "h": 330, "driver": True},
    tags=["stepper", "foc", "lift", "linear"],
    summary="A stepper that behaves like a servo. The integrated driver closes the loop on a "
            "magnetic encoder and commutates with field-oriented control, so it never loses steps "
            "and draws current in proportion to the load rather than constantly.",
    highlights=["Closed-loop FOC — no lost steps, no holding-current heat soak",
                "Magnetic encoder on the rear shaft",
                "Step/dir, UART or CAN command",
                "For lead screws, lifts and linear axes"],
    specs=S(("Performance", [("Holding torque", "0.45 N·m"), ("Step angle", "1.8° (200 steps/rev)"),
                             ("Microstepping", "Up to 1/256"), ("Rated current", "1.5 A/phase"),
                             ("Supply", "12–36 V DC")]),
            ("Feedback & control", [("Encoder", "14-bit magnetic, on-shaft"),
                                    ("Commutation", "Field-oriented control"),
                                    ("Interface", "Step/dir · UART · CAN")]),
            ("Physical", [("Frame", "NEMA 17, 42 mm"), ("Body length", "48 mm"),
                          ("Shaft", "5 mm with flat")])))

add(id="nema23-foc", sku="MR-ACT-N23FOC", cat="actuators", brand="MABEL Robotics",
    name="NEMA 23 Closed-Loop Stepper", tagline="Stepper + FOC driver, 1.9 N·m",
    cost_usd=62, cost_src="estimate", src="estimate", family="stepper",
    art={"body": "anod_grey", "s": 350, "h": 350, "driver": True},
    tags=["stepper", "foc", "gantry"],
    summary="The larger closed-loop stepper, for gantries, heavy lifts and anything that has to "
            "hold position with the power off the coils.",
    highlights=["1.9 N·m holding torque", "Closed-loop FOC with on-shaft encoder",
                "Step/dir, UART or CAN", "57 mm NEMA 23 frame"],
    specs=S(("Performance", [("Holding torque", "1.9 N·m"), ("Step angle", "1.8°"),
                             ("Rated current", "3.0 A/phase"), ("Supply", "24–48 V DC")]),
            ("Feedback & control", [("Encoder", "14-bit magnetic"),
                                    ("Commutation", "Field-oriented control"),
                                    ("Interface", "Step/dir · UART · CAN")]),
            ("Physical", [("Frame", "NEMA 23, 57 mm"), ("Shaft", "8 mm with flat")])))

add(id="lift-column", sku="MR-ACT-LIFT", cat="actuators", brand="MABEL Robotics",
    name="Linear Lift Column", tagline="635 mm stroke, three-stage",
    cost_usd=399, cost_src="bom", src="bom", family="lift_column",
    badge="In MABEL", tags=["mabel", "torso", "linear"],
    summary="A three-stage telescoping column that gives a mobile robot a floor-to-tabletop "
            "workspace. MABEL uses the column and frame from a FlexiSpot E7 Pro desk, driven by "
            "its own controller instead of the desk's.",
    highlights=["0–635 mm stroke, three stages", "Holds position with power removed",
                "Driven from a Pico + BTS7960 in MABEL, or from your own controller",
                "Turns a fixed-height robot into one that reaches the floor and the counter"],
    specs=S(("Performance", [("Stroke", "0–635 mm"), ("Stages", "3"),
                             ("Supply", "24 V DC"), ("Holding", "Leadscrew, self-locking")]),
            ("Integration", [("Control", "Direct H-bridge, or the MABEL Pico lift board"),
                             ("Feedback", "Hall/limit, position by count"),
                             ("Source", "FlexiSpot E7 Pro column and frame (CBR4830MD-E7WS)")]),
            ("Physical", [("Top plate", "Bolt pattern for the MABEL torso adapter")])))

add(id="planetary-gearbox-n17", sku="MR-ACT-PG17", cat="actuators", brand="MABEL Robotics",
    name="Planetary Gearbox, NEMA 17", tagline="5:1 / 10:1 / 27:1, low backlash",
    cost_usd=28, cost_src="estimate", src="estimate", family="gearbox",
    tags=["gearbox", "stepper"],
    summary="A planetary reduction that bolts to any NEMA 17 face. Trades speed for torque and "
            "reduces the resolution you need from the driver.",
    highlights=["5:1, 10:1 and 27:1 ratios", "≤1° backlash",
                "Standard NEMA 17 input face", "8 mm keyed output"],
    specs=S(("Performance", [("Ratios", "5:1 · 10:1 · 27:1"), ("Backlash", "≤ 1°"),
                             ("Rated output torque", "3 N·m at 10:1"), ("Efficiency", "≈ 90%")]),
            ("Physical", [("Input", "NEMA 17 face, 5 mm bore"), ("Output", "8 mm keyed"),
                          ("Mass", "260 g at 10:1")])))


# ==================================================================== WHEELS ==
add(id="swerve-module", sku="MR-WHL-SWRV", cat="wheels", brand="MABEL Robotics",
    name="MABEL Swerve Module", tagline="Holonomic drive module, assembled and tested",
    cost_usd=675, cost_src="bom", src="bom", family="swerve",
    badge="In MABEL", tags=["mabel", "base", "holonomic", "swerve"],
    summary="One corner of a holonomic base, built and run in before it ships. Independent drive "
            "and steering motors, a belt-driven azimuth stage with an absolute encoder, and a "
            "traction wheel — bolt three or four to a plate and the robot moves in any direction "
            "while facing any direction.",
    highlights=["Drive and azimuth motors, controllers, belt stage and wheel — complete",
                "Absolute azimuth encoder: no homing routine at power-on",
                "Continuous 360° steering, no wire wrap",
                "Every module is run through a steering and drive test before it ships"],
    specs=S(("Drive", [("Wheel diameter", "76 mm (3 in)"), ("Free speed", "4.4 m/s"),
                       ("Drive reduction", "Belt + planetary"), ("Traction", "Grey rubber tread")]),
            ("Steering", [("Azimuth range", "Continuous 360°"),
                          ("Azimuth feedback", "Absolute magnetic encoder"),
                          ("Azimuth reduction", "Belt drive")]),
            ("Interfaces", [("Bus", "CAN"), ("Supply", "24 V DC"),
                            ("Mounting", "Flat top plate, bolt circle")])),
    note="Ships complete. The REV-21-3005 catalogue module by itself does not include motors, "
         "controllers or framing — this one does.")

add(id="hexfellow-swerve-motor", sku="MR-WHL-HEXF", cat="wheels", brand="HexFellow",
    name="HexFellow FOC Drive Motor", tagline="CANopen field-oriented drive motor",
    cost_usd=182, cost_src="estimate", src="estimate", family="pancake",
    art={"body": "anod_grey", "d": 380, "h": 140},
    tags=["swerve", "canopen", "foc", "base"],
    summary="The motor inside a swerve module. Field-oriented control with the driver on board, "
            "speaking CANopen so it joins the same bus as the rest of the drivetrain.",
    highlights=["Integrated FOC driver — velocity and torque control out of the box",
                "CANopen: two motors per swerve module, all on one bus",
                "Temperature telemetry per motor",
                "Two per module in a four-module base"],
    specs=S(("Performance", [("Control", "Field-oriented, velocity and torque"),
                             ("Supply", "24 V DC")]),
            ("Interfaces", [("Protocol", "CANopen"), ("Telemetry", "Speed, current, temperature"),
                            ("Data format", "float32 process values")])))

add(id="azimuth-encoder-kit", sku="MR-WHL-AZENC", cat="wheels", brand="MABEL Robotics",
    name="Azimuth Encoder Kit", tagline="Absolute steering feedback for swerve",
    cost_usd=26, cost_src="estimate", src="estimate", family="pcb",
    art={"body": "pcb_blue", "w": 460, "h": 300},
    tags=["swerve", "encoder", "base"],
    summary="Absolute angle on the steering axis, so a module knows which way its wheel points "
            "the instant it powers on. Magnet, board, and the standoffs to set the air gap.",
    highlights=["14-bit absolute — no homing sweep at boot",
                "Diametric magnet and mount included",
                "SPI or PWM output", "Sets the air gap correctly by construction"],
    specs=S(("Performance", [("Resolution", "14-bit (16 384 counts/rev)"),
                             ("Type", "Absolute, on-axis magnetic"),
                             ("Air gap", "0.5–2.5 mm")]),
            ("Interfaces", [("Output", "SPI · PWM · analogue"), ("Supply", "3.3 or 5 V")])))

for _wid, _nm, _dia, _kind, _c, _sum in [
    ("wheel-traction-3", "Traction Wheel, 76 mm", "76 mm (3 in)", "traction", 14,
     "Grey non-marking tread on an aluminium hub. The default swerve wheel."),
    ("wheel-traction-6", "Traction Wheel, 152 mm", "152 mm (6 in)", "traction", 26,
     "A larger traction wheel for rougher floors, door thresholds and cable runs."),
    ("wheel-omni-100", "Omni Wheel, 100 mm", "100 mm", "omni", 19,
     "Rollers on the rim let the wheel slide sideways freely — three or four give a holonomic base without steering motors."),
    ("wheel-mecanum-152", "Mecanum Wheel, 152 mm", "152 mm", "mecanum", 44,
     "Angled rollers turn four independent wheels into full planar motion. Sold as a handed set of four."),
]:
    add(id=_wid, sku="MR-WHL-" + _wid.split("-")[-1].upper(), cat="wheels", brand="MABEL Robotics",
        name=_nm, tagline=_dia + " · " + _kind, cost_usd=_c, cost_src="estimate", src="estimate",
        family="wheel", art={"kind": _kind, "R": 300},
        tags=["base", _kind], summary=_sum,
        highlights=["Aluminium hub, not moulded plastic", "Standard hex or bolt-circle bore",
                    "Non-marking compound", "Matched sets available"],
        specs=S(("Wheel", [("Diameter", _dia), ("Type", _kind.title()),
                           ("Tread", "Non-marking rubber"), ("Hub", "Machined aluminium")]),
                ("Fitment", [("Bore", "1/2 in hex or M8 bolt circle"),
                             ("Load rating", "25 kg per wheel")])))

add(id="hub-motor-8", sku="MR-WHL-HUB8", cat="wheels", brand="MABEL Robotics",
    name="Hub Drive Motor, 8 in", tagline="Direct-drive wheel with integrated motor",
    cost_usd=98, cost_src="estimate", src="estimate", family="wheel",
    art={"kind": "traction", "R": 320, "hub": "anod_black"},
    tags=["base", "differential"],
    summary="Motor and wheel in one part. Nothing to align, nothing to tension — for differential "
            "bases where simplicity beats holonomy.",
    highlights=["Direct drive, no gearbox to service", "Hall sensors for smooth low-speed commutation",
                "Regenerative braking with a suitable controller", "Two make a differential base"],
    specs=S(("Performance", [("Diameter", "203 mm (8 in)"), ("Rated power", "250 W"),
                             ("Supply", "24–36 V DC"), ("Rated torque", "12 N·m")]),
            ("Feedback", [("Sensors", "3 × Hall"), ("Controller", "External BLDC/FOC required")])))

add(id="belt-pulley-set", sku="MR-WHL-HTD5", cat="wheels", brand="MABEL Robotics",
    name="HTD-5M Belt & Pulley Set", tagline="Timing belts, pulleys and tensioners",
    cost_usd=32, cost_src="estimate", src="estimate", family="fastener_set",
    art={"body": "plastic_bk"},
    tags=["base", "transmission"],
    summary="The transmission side of a swerve module or a belt-driven arm joint: matched HTD-5M "
            "belts, aluminium pulleys in the common tooth counts, and idlers to take up slack.",
    highlights=["HTD-5M profile — the standard for robot drivetrains",
                "Pulleys in 15T, 18T, 24T, 36T and 60T", "Closed-loop belts in five lengths",
                "Bearing idlers for tensioning"],
    specs=S(("Contents", [("Belt profile", "HTD-5M, 15 mm wide"),
                          ("Belt lengths", "150 · 225 · 300 · 375 · 450 mm"),
                          ("Pulleys", "15T · 18T · 24T · 36T · 60T, aluminium"),
                          ("Idlers", "2 × sealed-bearing")]),
            ("Fitment", [("Bore", "8 mm with M4 set screws"), ("Flanges", "Both sides on all pulleys")])))


# ================================================================== HARDWARE ==
add(id="screw-set-metric", sku="MR-HW-SCRW", cat="hardware", brand="MABEL Robotics",
    name="Metric Fastener Set, M2–M6", tagline="1 200 pieces, A2 stainless, sorted",
    cost_usd=13.99, cost_src="bom", src="bom", family="fastener_set",
    badge="In MABEL", tags=["mabel", "fasteners", "stainless"],
    summary="The set you actually reach for. Socket-head cap screws from M2 to M6 in the lengths "
            "a robot needs, with matching nuts and washers, in a case with dividers that stay put.",
    highlights=["A2 stainless throughout — no rust on a robot that lives near a sink",
                "M2, M2.5, M3, M4, M5, M6 in 6–30 mm lengths",
                "Nyloc nuts and flat washers to match every size",
                "Latching case with fixed dividers"],
    specs=S(("Contents", [("Screws", "M2–M6 socket head cap, 6–30 mm"),
                          ("Nuts", "Nyloc and plain hex, M2–M6"),
                          ("Washers", "Flat and split, M2–M6"), ("Total pieces", "≈ 1 200")]),
            ("Material", [("Grade", "A2 / 304 stainless"), ("Drive", "Hex socket"),
                          ("Thread", "Coarse, ISO metric")])))

add(id="heatset-insert-kit", sku="MR-HW-INSRT", cat="hardware", brand="MABEL Robotics",
    name="Heat-Set Insert Kit, M2–M5", tagline="Brass inserts plus the soldering tips",
    cost_usd=17, cost_src="estimate", src="estimate", family="fastener_set",
    art={"body": "plastic_bk"},
    tags=["3d-printing", "fasteners"],
    summary="Threads in printed plastic that survive being taken apart. Knurled brass inserts melt "
            "into the print and give you a real machine thread — the single biggest upgrade to a "
            "3D-printed robot's serviceability.",
    highlights=["M2, M2.5, M3, M4 and M5 in short and long forms",
                "Matched soldering-iron tips for each size — the part most kits leave out",
                "Knurled and barbed so they resist both pull-out and rotation",
                "500 inserts, enough for a whole robot"],
    specs=S(("Contents", [("Inserts", "M2 · M2.5 · M3 · M4 · M5, two lengths each"),
                          ("Quantity", "500 pieces"), ("Tips", "5 installation tips, M3 iron thread")]),
            ("Material", [("Insert", "Brass, knurled and barbed"),
                          ("Working temperature", "200–250 °C")])))

for _eid, _nm, _prof, _slots, _c, _sum in [
    ("extrusion-2020", "Aluminium Extrusion, 20×20", "20 × 20 mm", 4, 9.5,
     "The default frame stock. Light, stiff enough for most robot structure, and every bracket in the world fits it."),
    ("extrusion-2040", "Aluminium Extrusion, 20×40", "20 × 40 mm", 4, 16,
     "Twice the section modulus in the direction that matters. For gantry beams and cantilevered arms."),
    ("extrusion-1010", "Aluminium Extrusion, 1×1 in", "25.4 × 25.4 mm (1010)", 4, 12,
     "Imperial 1010-series, for frames that have to bolt to imperial hardware."),
    ("extrusion-2x2", "Aluminium Extrusion, 2×2 in", "50.8 × 50.8 mm", 4, 34,
     "Heavy structural section. MABEL's body frame is built from 2×2 and 2×4 in stock."),
]:
    add(id=_eid, sku="MR-HW-" + _eid.split("-")[-1].upper(), cat="hardware", brand="MABEL Robotics",
        name=_nm, tagline=_prof + " T-slot · cut to length", cost_usd=_c, cost_src="bom",
        src="vendor", family="extrusion", art={"slots": _slots},
        badge="In MABEL" if _eid in ("extrusion-2x2",) else "",
        tags=["mabel", "frame", "extrusion"] if _eid == "extrusion-2x2" else ["frame", "extrusion"],
        summary=_sum,
        highlights=["Cut to your length, ±0.5 mm, ends faced square",
                    "6063-T5, clear anodised", "T-slot on every face",
                    "Priced per 100 mm — order the length you need"],
        specs=S(("Profile", [("Section", _prof), ("Slot width", "6 mm" if "20" in _prof else "8 mm"),
                             ("Alloy", "6063-T5"), ("Finish", "Clear anodised")]),
                ("Supply", [("Cut tolerance", "±0.5 mm"), ("Ends", "Faced square"),
                            ("Priced", "Per 100 mm"), ("Maximum length", "2 000 mm")])),
        unit="per 100 mm")

add(id="extrusion-brackets", sku="MR-HW-BRKT", cat="hardware", brand="MABEL Robotics",
    name="Extrusion Bracket Set", tagline="Corner brackets, angled plates and T-nuts",
    cost_usd=26.90, cost_src="bom", src="bom", family="fastener_set",
    art={"body": "plastic_bk"},
    badge="In MABEL", tags=["mabel", "frame", "extrusion"],
    summary="Everything that joins one piece of extrusion to another: 90° corner brackets, "
            "angled joining plates, and the spring T-nuts that let you add a bracket without "
            "taking the frame apart.",
    highlights=["90° corner brackets, gusseted", "Angled joining plates for non-square frames",
                "Spring T-nuts — drop in anywhere along a slot",
                "Button-head screws sized to the nuts, included"],
    specs=S(("Contents", [("Corner brackets", "20 × 90°, gusseted"),
                          ("Angled plates", "20 × adjustable"),
                          ("T-nuts", "100 × spring-loaded"), ("Screws", "120 × M5 button head")]),
            ("Fitment", [("Series", "20-series and 1010"), ("Material", "Die-cast zinc, black")])))

add(id="bearing-set", sku="MR-HW-BRNG", cat="hardware", brand="MABEL Robotics",
    name="Deep-Groove Bearing Set", tagline="608, 625, 6800, 6805 · sealed",
    cost_usd=24, cost_src="estimate", src="estimate", family="bearing",
    tags=["bearings", "rotation"],
    summary="The four bearing sizes that show up again and again in robot joints, idlers and "
            "tensioners, in rubber-sealed ABEC-3 grade. Twenty of each.",
    highlights=["608, 625, 6800 and 6805, twenty of each",
                "Rubber-sealed — survives a workshop", "ABEC-3, pre-lubricated",
                "Chrome steel races"],
    specs=S(("Sizes", [("608-2RS", "8 × 22 × 7 mm"), ("625-2RS", "5 × 16 × 5 mm"),
                       ("6800-2RS", "10 × 19 × 5 mm"), ("6805-2RS", "25 × 37 × 7 mm")]),
            ("Specification", [("Grade", "ABEC-3"), ("Seals", "Rubber, both sides"),
                               ("Material", "GCr15 chrome steel"), ("Quantity", "80 pieces total")])))

add(id="thin-section-bearing", sku="MR-HW-XSEC", cat="hardware", brand="MABEL Robotics",
    name="Crossed-Roller Bearing", tagline="Single bearing takes moment, thrust and radial load",
    cost_usd=64, cost_src="estimate", src="estimate", family="bearing",
    art={"balls": 20, "R": 300},
    tags=["bearings", "joint", "harmonic"],
    summary="One bearing where a joint would otherwise need three. Rollers alternate at 90°, so a "
            "single thin race carries radial load, axial load in both directions, and the "
            "overturning moment of a cantilevered link.",
    highlights=["Takes radial, axial and moment load in one race",
                "Thin section — the joint stays compact",
                "The standard output bearing for harmonic joints",
                "Pre-loaded, no shimming needed"],
    specs=S(("Bearing", [("Type", "Crossed roller, alternating 90°"),
                         ("Bore", "50 mm"), ("Outer diameter", "80 mm"), ("Width", "15 mm")]),
            ("Rating", [("Dynamic load", "12.4 kN"), ("Tilting rigidity", "Pre-loaded, zero clearance"),
                        ("Runout", "≤ 0.01 mm")])))

add(id="linear-rail-mgn12", sku="MR-HW-MGN12", cat="hardware", brand="MABEL Robotics",
    name="Linear Rail MGN12 + Carriage", tagline="Recirculating-ball linear guide",
    cost_usd=29, cost_src="estimate", src="estimate", family="plate",
    art={"body": "steel", "w": 620, "h": 190, "bend": False},
    tags=["linear", "gantry"],
    summary="Stiff, low-friction linear motion. Recirculating balls in a hardened steel rail — the "
            "guide that makes a printed linear axis behave like a machine tool.",
    highlights=["MGN12H carriage with four ball circuits",
                "Hardened and ground rail, ±0.02 mm straightness",
                "Cut to length with mounting holes on 25 mm centres",
                "Pre-lubricated, with wipers on both ends"],
    specs=S(("Rail", [("Series", "MGN12"), ("Width", "12 mm"), ("Height", "8 mm"),
                      ("Hole pitch", "25 mm"), ("Lengths", "200–1 000 mm")]),
            ("Carriage", [("Type", "MGN12H, long body"), ("Dynamic load", "3.4 kN"),
                          ("Static load", "5.7 kN"), ("Accuracy", "±0.02 mm straightness")])))

add(id="leadscrew-t8", sku="MR-HW-T8", cat="hardware", brand="MABEL Robotics",
    name="T8 Lead Screw & Anti-Backlash Nut", tagline="8 mm trapezoidal, 2 mm lead",
    cost_usd=17, cost_src="estimate", src="estimate", family="plate",
    art={"body": "steel", "w": 600, "h": 150, "bend": False},
    tags=["linear", "lift"],
    summary="Turns rotation into a lift that holds itself up. A 2 mm lead is self-locking, so the "
            "axis stays where you left it when the motor is off.",
    highlights=["Self-locking at 2 mm lead — no brake needed",
                "Spring-loaded anti-backlash nut", "Stainless screw, POM nut",
                "Cut to length, ends turned for a bearing"],
    specs=S(("Screw", [("Diameter", "8 mm"), ("Lead", "2 mm/rev"), ("Thread", "Trapezoidal Tr8"),
                       ("Material", "304 stainless"), ("Lengths", "200–1 000 mm")]),
            ("Nut", [("Type", "Anti-backlash, spring preloaded"), ("Material", "POM"),
                     ("Flange", "Ø 22 mm, 3 × M3")])))

add(id="magnet-set", sku="MR-HW-MAGN", cat="hardware", brand="MABEL Robotics",
    name="Neodymium Magnet Set", tagline="N52 discs for panels and covers",
    cost_usd=11.99, cost_src="bom", src="bom", family="fastener_set",
    art={"body": "anod_black"},
    badge="In MABEL", tags=["mabel", "covers"],
    summary="How MABEL's covers stay on and still come off in a second. N52 discs in three sizes, "
            "sized to press-fit into a printed pocket.",
    highlights=["N52 — the strongest commercial grade",
                "6, 8 and 10 mm discs, nickel plated",
                "Press-fit into a 0.1 mm interference pocket",
                "Comes with steel keeper plates"],
    specs=S(("Magnets", [("Grade", "N52 neodymium"), ("Sizes", "6×3 · 8×3 · 10×3 mm"),
                         ("Quantity", "60 pieces"), ("Plating", "Ni-Cu-Ni")]),
            ("Notes", [("Max temperature", "80 °C"), ("Pull force", "1.1 kg at 8×3 mm")])))

# --- MABEL / OpenArm / ORCA structure, priced from the BOM's machining quotes --
add(id="openarm-structure", sku="MR-HW-OARM", cat="hardware", brand="MABEL Robotics",
    name="OpenArm Structural Set", tagline="CNC 7075 aluminium and sheet steel, dual arm",
    cost_cny=2699, cost_src="bom", src="bom", family="plate",
    art={"body": "alu", "w": 600, "h": 280},
    badge="In MABEL", tags=["mabel", "arm", "openarm", "machined"],
    summary="Every structural part for a pair of 7-DOF OpenArm arms, machined from 7075 aluminium "
            "with sheet-steel brackets where stiffness matters more than mass. The parts the "
            "DAMIAO joints bolt into.",
    highlights=["Complete dual-arm set — links, brackets, covers, hardware",
                "7075-T6 CNC for the links, sheet steel for the shoulder brackets",
                "Bores reamed to the joint flanges, no fitting required",
                "Matches the published OpenArm geometry"],
    specs=S(("Material", [("Links", "7075-T6 aluminium, CNC"),
                          ("Brackets", "Sheet steel, laser cut and bent"),
                          ("Finish", "Clear anodised / powder coat")]),
            ("Contents", [("Coverage", "Both arms, 7 DOF each"),
                          ("Fasteners", "Included, sized per joint"),
                          ("Bore tolerance", "H7 at every joint flange")])))

for _pid, _nm, _cost, _ops, _qty in [
    ("mabel-base-lower", "MABEL Base Plate, Lower", 51.75, "Laser cut, no secondary operations", "1"),
    ("mabel-base-upper", "MABEL Base Plate, Upper", 195.36, "4 bends · dimple forming · hardware insertion · tapping", "1"),
    ("mabel-lift-adapter", "MABEL Lift-to-Torso Adapter", 59.26, "2 bends · dimple forming · hardware insertion · tapping", "1"),
    ("mabel-torso-plate", "MABEL Torso Output Plate", 55.16, "1 bend · hardware insertion · tapping", "1"),
    ("mabel-body-bottom", "MABEL Body Bottom Plate", 33.55, "2 bends · hardware insertion · tapping", "1"),
    ("mabel-arm-plate", "MABEL Arm Mounting Plate", 13.17, "Hardware insertion · tapping", "2 (one per arm)"),
    ("mabel-neck-plate", "MABEL Neck Mounting Plate", 29.05, "2 bends", "1"),
]:
    add(id=_pid, sku="MR-HW-" + _pid.split("mabel-")[1].upper().replace("-", ""), cat="hardware",
        brand="MABEL Robotics", name=_nm, tagline="Laser-cut sheet metal · " + _ops.split(" · ")[0],
        cost_usd=_cost, cost_src="bom", src="bom", family="plate",
        art={"body": "alu", "bend": "bend" in _ops},
        badge="In MABEL", tags=["mabel", "machined", "structure"],
        summary="A structural part from MABEL's own build, cut from the same files the robot ships "
                "with. Ordered as one part or in the quantity a full robot needs.",
        highlights=[_ops.capitalize(), "Cut from the released MABEL DXF",
                    "Volume pricing from 1 to 1 000 off", "Hardware pressed in before it ships"],
        specs=S(("Manufacture", [("Process", "Laser cut sheet metal"), ("Operations", _ops),
                                 ("Quantity per robot", _qty)]),
                ("Material", [("Stock", "Aluminium or mild steel, per drawing"),
                              ("Finish", "Mill, anodised or powder coat"),
                              ("Tolerance", "±0.2 mm cut, ±0.5° bend")])))

add(id="orca-hand-kit", sku="MR-HW-ORCA", cat="hardware", brand="MABEL Robotics",
    name="ORCA Hand Structural Kit", tagline="Frames, tendons, pulleys and tensioners",
    cost_usd=225, cost_src="estimate", src="estimate", family="hand",
    badge="In MABEL", tags=["mabel", "orca", "hand", "tendon"],
    summary="Everything an ORCA hand needs that is not a servo: printed and machined finger "
            "frames, the Dyneema tendon, routing pulleys, tensioners, bearings and fingertip pads. "
            "One kit builds one 17-DOF hand.",
    highlights=["17 DOF — 16 finger joints plus a wrist",
                "Dyneema tendon, pre-cut and terminated",
                "Routing pulleys on bearings, not bushings",
                "Silicone fingertip pads, moulded"],
    specs=S(("Contents", [("Coverage", "One complete hand, less servos"),
                          ("Degrees of freedom", "17 (16 finger + 1 wrist)"),
                          ("Tendon", "Dyneema SK99, 0.8 mm, pre-terminated"),
                          ("Pulleys", "Bearing-mounted, 24 off")]),
            ("Requires", [("Servos", "16 × HL3915M + 1 × HL3930M, sold separately"),
                          ("Driver", "ST/SC bus driver board and 5264 splitter")])))

add(id="tendon-dyneema", sku="MR-HW-TNDN", cat="hardware", brand="MABEL Robotics",
    name="Dyneema Tendon Line", tagline="SK99, 0.8 mm, 25 m",
    cost_usd=16, cost_src="estimate", src="estimate", family="cable_coil",
    art={"body": "plastic_wh", "c1": "alu_dark", "c2": "alu_dark"},
    tags=["orca", "hand", "tendon"],
    summary="The line that moves a tendon-driven finger. Dyneema SK99 barely creeps under load, "
            "which is what keeps a hand calibrated between sessions.",
    highlights=["SK99 — the lowest-creep grade available",
                "0.8 mm, 90 kg breaking strain", "Pre-stretched at the factory",
                "25 m: enough to re-tendon a hand several times"],
    specs=S(("Line", [("Material", "Dyneema SK99, 12-strand"), ("Diameter", "0.8 mm"),
                      ("Breaking strain", "90 kg"), ("Length", "25 m")]),
            ("Behaviour", [("Creep", "Pre-stretched, minimal"), ("Elongation at break", "< 3.5%")])))

add(id="silicone-kit", sku="MR-HW-SIL", cat="hardware", brand="MABEL Robotics",
    name="Platinum-Cure Silicone Kit", tagline="Two-part, Shore A20 · for hand pads and skins",
    cost_usd=42, cost_src="estimate", src="estimate", family="silicone_kit",
    tags=["orca", "hand", "silicone", "casting"],
    summary="Two-part platinum-cure silicone for fingertip pads, grip skins and compliant covers. "
            "Mixes 1:1 by weight, cures without shrinking, and takes pigment.",
    highlights=["Shore A20 — grippy without being sticky",
                "1:1 mix, no scale gymnastics", "Platinum cure: no shrinkage, no inhibition on PLA",
                "Includes mixing cups, stirrers and a degassing tip sheet"],
    specs=S(("Material", [("Type", "Platinum-cure (addition) silicone"), ("Hardness", "Shore A20"),
                          ("Mix ratio", "1:1 by weight"), ("Pot life", "30 min at 23 °C"),
                          ("Cure time", "6 h at 23 °C, 20 min at 65 °C")]),
            ("Contents", [("Quantity", "2 × 500 g"), ("Extras", "Cups, stirrers, gloves"),
                          ("Tensile strength", "3.5 MPa")])))

for _fid, _nm, _col, _c, _sum in [
    ("filament-pla-white", "PLA Basic, Jade White", "plastic_wh", 22.99,
     "MABEL's covers, sensor mounts and trim. Prints clean and takes an edge break without splintering."),
    ("filament-pla-black", "PLA Basic, Black", "plastic_bk", 22.99,
     "The ORCA hand frames — the highest-wear printed parts on the robot."),
    ("filament-petg-cf", "PETG-CF, Black", "carbon", 34.99,
     "Carbon-filled PETG for brackets that see load and heat. Stiffer than PLA and it does not creep at 40 °C."),
]:
    add(id=_fid, sku="MR-HW-" + _fid.split("filament-")[1].upper().replace("-", ""), cat="hardware",
        brand="Bambu Lab" if "pla" in _fid else "MABEL Robotics", name=_nm,
        tagline="1.75 mm · 1 kg with spool", cost_usd=_c, cost_src="bom", src="vendor",
        family="filament", art={"color": _col},
        badge="In MABEL" if "pla" in _fid else "", tags=["mabel", "3d-printing"],
        summary=_sum,
        highlights=["1.75 mm, 1 kg on a spool", "Dimensional tolerance ±0.03 mm",
                    "RFID spool, recognised automatically on Bambu printers" if "pla" in _fid
                    else "Dried and vacuum sealed at the factory",
                    "Bulk pricing from four spools"],
        specs=S(("Filament", [("Diameter", "1.75 mm ±0.03"), ("Net weight", "1 kg"),
                              ("Nozzle temperature", "190–230 °C" if "pla" in _fid else "240–270 °C"),
                              ("Bed temperature", "35–45 °C" if "pla" in _fid else "70–90 °C")]),
                ("Notes", [("Nozzle", "Any" if "pla" in _fid else "Hardened steel required"),
                           ("Drying", "Not required" if "pla" in _fid else "8 h at 65 °C if opened")])))

add(id="cable-chain", sku="MR-HW-DRAG", cat="hardware", brand="MABEL Robotics",
    name="Cable Drag Chain", tagline="10 × 20 mm, openable links, 2 m",
    cost_usd=18, cost_src="estimate", src="estimate", family="cable_coil",
    art={"body": "plastic_bk", "c1": "anod_black", "c2": "anod_black"},
    tags=["harness", "linear"],
    summary="Keeps a moving harness from becoming a failed harness. Openable links so you can add "
            "a cable later without pulling the whole loom.",
    highlights=["Links open on one side — re-route without disassembly",
                "10 × 20 mm inner section", "2 m with both end brackets",
                "Rated to five million cycles"],
    specs=S(("Chain", [("Inner section", "10 × 20 mm"), ("Bend radius", "28 mm"),
                       ("Length", "2 m"), ("Material", "Reinforced nylon")]),
            ("Rating", [("Cycle life", "5 million"), ("Temperature", "−20 to 100 °C"),
                        ("Ends", "2 mounting brackets included")])))


# =============================================================== ELECTRONICS ==
add(id="damiao-usb2can", sku="MR-EL-U2C", cat="electronics", brand="DAMIAO",
    name="DAMIAO USB-to-CAN Adapter", tagline="The bench tool for every CAN joint",
    cost_usd=32, cost_src="bom", src="vendor", family="pcb",
    art={"body": "pcb_black", "w": 520, "h": 300},
    badge="In MABEL", tags=["mabel", "can", "bench", "usb"],
    summary="The first thing you plug in. A USB-CAN bridge that enumerates as a serial port on "
            "macOS, Linux and Windows, so you can scan a bus, set a node ID and spin a joint "
            "before any of it is bolted to a robot.",
    highlights=["Enumerates as a CDC serial port — no kernel module on macOS",
                "1 Mbit/s CAN, the rate every DAMIAO and CyberGear joint expects",
                "Bus-powered, with a switchable 120 Ω termination",
                "Works with the DAMIAO, CyberGear and CANopen tooling as shipped"],
    specs=S(("Bus", [("Protocol", "CAN 2.0A / 2.0B"), ("Bit rate", "Up to 1 Mbit/s"),
                     ("Termination", "Switchable 120 Ω"), ("Isolation", "None (bench tool)")]),
            ("Host", [("Interface", "USB 2.0, Type-C"), ("Enumeration", "USB CDC serial"),
                      ("Drivers", "None required on macOS or Linux"),
                      ("Tooling", "DAMIAO debug app, python-can via slcan")])))

add(id="can-hub", sku="MR-EL-CANHUB", cat="electronics", brand="DAMIAO",
    name="CAN Bus Hub", tagline="Six-drop splitter with termination",
    cost_usd=14, cost_src="estimate", src="estimate", family="pcb",
    art={"body": "pcb_green", "w": 500, "h": 280, "usb": False},
    tags=["can", "harness"],
    summary="Turns one CAN run into six short drops, so a six-joint arm is one cable to the "
            "controller instead of six daisy chains that fail one connector at a time.",
    highlights=["Six drops from one trunk", "Switchable termination at the end of the bus",
                "Screw terminals and JST-GH on every drop", "Per-drop activity LED"],
    specs=S(("Bus", [("Drops", "6"), ("Bit rate", "Up to 1 Mbit/s"),
                     ("Termination", "Switchable 120 Ω"), ("Connectors", "Screw terminal + JST-GH")]),
            ("Physical", [("Supply", "Pass-through 24 V"), ("Indicators", "Per-drop TX/RX LED")])))

add(id="servo-ttl-driver", sku="MR-EL-TTL", cat="electronics", brand="Feetech",
    name="ST/SC Bus Servo Driver Board", tagline="USB-UART bridge for TTL servos",
    cost_cny=27.65, cost_src="bom", src="bom", family="pcb",
    art={"body": "pcb_blue", "w": 480, "h": 290},
    badge="In MABEL", tags=["mabel", "orca", "hand", "ttl"],
    summary="Puts a whole TTL servo chain on one USB port. One board per ORCA hand drives all "
            "seventeen servos at 1 Mbit, and the same board is how you set servo IDs in the first "
            "place.",
    highlights=["1 Mbit half-duplex TTL, up to 253 servos on a chain",
                "USB-UART bridge — appears as a serial port",
                "The tool for assigning servo IDs during a hand build",
                "One per ORCA hand"],
    specs=S(("Bus", [("Protocol", "Feetech ST/SC half-duplex TTL"),
                     ("Bit rate", "Up to 1 Mbit/s"), ("Devices", "Up to 253 per chain")]),
            ("Host", [("Interface", "USB, CDC serial"), ("Servo power", "Separate input, up to 12 V"),
                      ("Compatibility", "STS, SCS and HL series")])))

add(id="servo-splitter", sku="MR-EL-5264", cat="electronics", brand="Feetech",
    name="Bus Servo Power Splitter", tagline="8-way 5264 hub for grouped supply",
    cost_cny=18, cost_src="bom", src="bom", family="pcb",
    art={"body": "pcb_green", "w": 470, "h": 250, "usb": False},
    badge="In MABEL", tags=["mabel", "orca", "hand", "power"],
    summary="Eight 5264 terminals off one supply, so sixteen finger servos draw from a proper "
            "distribution point instead of a chain of pass-through connectors.",
    highlights=["Eight 5264 drops from one input", "Signal passes through, power is star-fed",
                "Removes the voltage droop at the end of a long servo chain", "One per hand"],
    specs=S(("Distribution", [("Drops", "8 × 5264"), ("Input", "5264, up to 12 V"),
                              ("Current", "10 A total"), ("Topology", "Star power, bussed signal")]),
            ("Physical", [("Mounting", "4 × M2"), ("Size", "48 × 32 mm")])))

for _bid, _nm, _tag, _c, _sum, _rows in [
    ("buck-24-12", "Buck Converter, 24 V → 12 V", "10 A synchronous step-down", 18.99,
     "Feeds the 12 V rail every bus servo and camera hub wants from the robot's 24 V pack.",
     [("Input", "18–36 V DC"), ("Output", "12 V, 10 A"), ("Efficiency", "96% typical"),
      ("Protection", "Over-current, over-temperature, reverse polarity")]),
    ("buck-24-5", "Buck Converter, 24 V → 5 V", "8 A for logic and USB", 14.99,
     "The logic rail. Enough headroom to run a Pi, a hub and the sensor boards without sag.",
     [("Input", "18–36 V DC"), ("Output", "5 V, 8 A"), ("Efficiency", "94% typical"),
      ("Protection", "Over-current, over-temperature")]),
]:
    add(id=_bid, sku="MR-EL-" + _bid.upper().replace("-", ""), cat="electronics",
        brand="MABEL Robotics", name=_nm, tagline=_tag, cost_usd=_c, cost_src="bom", src="vendor",
        family="pcb", art={"body": "pcb_blue", "w": 500, "h": 280, "usb": False},
        badge="In MABEL", tags=["mabel", "power"], summary=_sum,
        highlights=["Synchronous rectification — runs cool at load",
                    "Screw terminals, not barrel jacks", "Adjustable output, factory set",
                    "Fits the MABEL power tray"],
        specs=S(("Electrical", _rows), ("Physical", [("Terminals", "Screw, 12 AWG"),
                                                     ("Cooling", "Anodised heatsink body")])))

add(id="power-distribution", sku="MR-EL-PDB", cat="electronics", brand="MABEL Robotics",
    name="Power Distribution Board", tagline="Fused 24 V distribution with per-rail sense",
    cost_usd=44, cost_src="estimate", src="estimate", family="pcb",
    art={"body": "pcb_black", "w": 560, "h": 340, "usb": False},
    badge="In MABEL", tags=["mabel", "power", "safety"],
    summary="One board between the battery and everything else. Eight individually fused outputs, "
            "current sense on each, and an e-stop input that cuts actuator power without cutting "
            "the computer — so the robot stops but the log keeps writing.",
    highlights=["Eight fused outputs, blade fuses, per-rail LED",
                "Actuator rails drop on e-stop; the compute rail does not",
                "Current sense on every rail, readable over I²C",
                "Bolt-down XT60 input, ring terminals on the load side"],
    specs=S(("Distribution", [("Input", "24 V DC, XT60, 60 A"), ("Outputs", "8, individually fused"),
                              ("Fuses", "Blade, 5–30 A"), ("Sense", "INA219 per rail, I²C")]),
            ("Safety", [("E-stop", "Hardware latch, actuator rails only"),
                        ("Compute rail", "Always on, separately fused"),
                        ("Indicators", "Per-rail LED, blown-fuse detect")])))

add(id="estop-kit", sku="MR-EL-ESTOP", cat="electronics", brand="MABEL Robotics",
    name="Hardware E-Stop Kit", tagline="Latching mushroom, contactor and harness",
    cost_usd=58, cost_src="estimate", src="estimate", family="pcb",
    art={"body": "pcb_black", "w": 520, "h": 300, "usb": False},
    tags=["safety", "power"],
    summary="An e-stop that works when the software does not. A latching mushroom head drives a "
            "contactor that de-energises the actuator bus in hardware — no firmware, no CAN, no "
            "host involved.",
    highlights=["De-energises actuators independently of the host",
                "Latching mushroom head, twist to release",
                "Normally-closed contacts: a broken wire stops the robot",
                "Pre-made harness, no crimping"],
    specs=S(("Switch", [("Type", "Latching mushroom, twist release"), ("Contacts", "2 × NC"),
                        ("Rating", "10 A at 250 V AC / 24 V DC")]),
            ("Contactor", [("Coil", "24 V DC"), ("Switching", "60 A DC"),
                           ("Fail-safe", "Normally open — loss of coil power stops the robot")])))

add(id="fuse-box", sku="MR-EL-FUSE", cat="electronics", brand="MABEL Robotics",
    name="Blade Fuse Distribution Box", tagline="12-way with LED blown-fuse indication",
    cost_usd=15.99, cost_src="bom", src="bom", family="pcb",
    art={"body": "pcb_black", "w": 500, "h": 280, "usb": False},
    badge="In MABEL", tags=["mabel", "power"],
    summary="Twelve fused circuits with an LED on each holder that lights when the fuse is gone. "
            "The five-dollar part that saves an hour of continuity testing.",
    highlights=["12 circuits, standard ATO/ATC blade fuses",
                "LED per holder lights on a blown fuse", "Bus bar input, ring terminal outputs",
                "Transparent cover, gasket sealed"],
    specs=S(("Distribution", [("Circuits", "12"), ("Fuse type", "ATO/ATC blade"),
                              ("Max per circuit", "30 A"), ("Total", "100 A")]),
            ("Physical", [("Cover", "Transparent, gasketed"), ("Input", "M6 stud")])))

for _cid, _nm, _tag, _c, _sum, _hl in [
    ("connector-xt", "XT60 / XT30 Connector Kit", "Power connectors with heatshrink", 19,
     "The power connectors that do not melt. Gold-plated bullets in a nylon shell, in both sizes a robot uses.",
     ["10 pairs XT60, 10 pairs XT30", "Gold-plated contacts", "Pre-cut heatshrink included",
      "Keyed shells — cannot be plugged in reversed"]),
    ("connector-jst", "JST-GH / JST-XH Connector Kit", "Signal connectors with a crimper", 34,
     "Signal connectors and the tool that makes them. JST-GH for anything that moves, XH for anything that does not.",
     ["JST-GH 1.25 mm, 2–6 pin", "JST-XH 2.54 mm, 2–6 pin", "Ratcheting crimper included",
      "600 contacts, 120 housings"]),
]:
    add(id=_cid, sku="MR-EL-" + _cid.split("-")[1].upper(), cat="electronics", brand="MABEL Robotics",
        name=_nm, tagline=_tag, cost_usd=_c, cost_src="estimate", src="estimate",
        family="fastener_set", art={"body": "plastic_bk"},
        tags=["harness", "connectors"], summary=_sum, highlights=_hl,
        specs=S(("Contents", [("Housings", "120"), ("Contacts", "600"), ("Tool", "Ratcheting crimper" if "jst" in _cid else "Heatshrink set")]),
                ("Rating", [("Current", "60 A (XT60) / 30 A (XT30)" if "xt" in _cid else "3 A per contact"),
                            ("Plating", "Gold")])))

add(id="harness-arm", sku="MR-EL-HRNA", cat="electronics", brand="MABEL Robotics",
    name="Arm Harness Set", tagline="Loom, hub, e-stop, adapter board and PSU",
    cost_cny=865, cost_src="bom", src="bom", family="cable_coil",
    badge="In MABEL", tags=["mabel", "arm", "harness", "power"],
    summary="The wiring for a dual-arm build, made up and tested: the loom itself, a CAN hub, an "
            "e-stop, a power adapter board and the supply. It is an evening of crimping you do "
            "not have to do, and one fewer intermittent fault to chase.",
    highlights=["Complete loom for both arms, labelled at both ends",
                "CAN hub and power adapter board included",
                "E-stop in line", "Continuity and hi-pot tested before it ships"],
    specs=S(("Contents", [("Loom", "Both arms, 7 DOF each"), ("Hub", "CAN, 6 drops"),
                          ("Safety", "In-line e-stop"), ("Supply", "24 V PSU included")]),
            ("Build", [("Labelling", "Both ends of every conductor"),
                       ("Sleeving", "Braided, heat-shrunk terminations"),
                       ("Test", "Continuity and insulation tested")])))

add(id="usb-hub", sku="MR-EL-HUB", cat="electronics", brand="MABEL Robotics",
    name="Powered USB 3 Hub", tagline="7-port, externally powered",
    cost_usd=74.99, cost_src="bom", src="bom", family="switch",
    art={"body": "anod_grey"},
    badge="In MABEL", tags=["mabel", "cameras", "usb"],
    summary="Cameras are demanding USB citizens. An externally powered hub keeps four global-"
            "shutter streams alive without browning out when they all start at once.",
    highlights=["Seven USB 3 ports, externally powered",
                "Per-port power switching", "Metal case, DIN or flat mount",
                "Feeds MABEL's whole camera tree"],
    specs=S(("Ports", [("Downstream", "7 × USB 3.0, 5 Gbit/s"), ("Upstream", "USB-B 3.0"),
                       ("Per-port current", "0.9 A")]),
            ("Power", [("Supply", "External 12 V, 4 A"), ("Switching", "Per port"),
                       ("Case", "Aluminium")])),
    note="USB bandwidth contention on this tree is a known source of camera latency — see the "
         "MABEL camera notes before hanging four streams off one controller.")

add(id="net-switch", sku="MR-EL-SW25", cat="electronics", brand="MABEL Robotics",
    name="2.5 GbE Managed Switch", tagline="4 × 2.5G + 2 × 10G SFP+",
    cost_usd=49.99, cost_src="bom", src="bom", family="switch",
    badge="In MABEL", tags=["mabel", "network"],
    summary="The onboard network spine. Four 2.5 GbE copper ports for the compute and sensors, two "
            "10 G SFP+ cages for the link off the robot.",
    highlights=["4 × 2.5G BASE-T, 2 × 10G SFP+", "Managed: VLANs, port mirroring, LACP",
                "Fanless", "12 V input — runs straight off the robot's rail"],
    specs=S(("Ports", [("Copper", "4 × 2.5G BASE-T"), ("Fibre/DAC", "2 × 10G SFP+"),
                       ("Switching capacity", "60 Gbit/s")]),
            ("Management", [("Features", "VLAN, port mirroring, LACP, QoS"),
                            ("Cooling", "Fanless"), ("Supply", "12 V DC")])))

add(id="battery-pack", sku="MR-EL-BATT", cat="electronics", brand="MABEL Robotics",
    name="24 V Li-ion Battery Pack", tagline="24 V · 20 Ah · BMS and XT60",
    cost_usd=46.81, cost_src="bom", src="bom", family="battery",
    badge="In MABEL", tags=["mabel", "power"],
    summary="The pack that lets the robot leave the bench. Integrated BMS with cell balancing, "
            "over-current and over-discharge cut-out, and a fuel gauge you can read over the wire.",
    highlights=["24 V nominal, 20 Ah — around 90 minutes of mixed driving and manipulation",
                "BMS with balancing and over-discharge protection",
                "XT60 output, standard barrel charge input",
                "Two fit MABEL's base tray"],
    specs=S(("Cells", [("Chemistry", "Li-ion 18650"), ("Configuration", "7S"),
                       ("Nominal voltage", "25.9 V"), ("Capacity", "20 Ah / 518 Wh")]),
            ("Protection", [("BMS", "Balancing, OCP, OVP, UVP, short circuit"),
                            ("Continuous discharge", "30 A"), ("Charge", "29.4 V, 5 A max"),
                            ("Output", "XT60")])))

for _mid, _nm, _tag, _c, _sum, _hl, _sp in [
    ("pico", "Raspberry Pi Pico", "RP2040 microcontroller", 15.95,
     "The small brain for a single loop. MABEL runs the lift leadscrew from one.",
     ["Dual Cortex-M0+ at 133 MHz", "Programmable I/O — bit-bang any protocol",
      "MicroPython or C SDK", "Runs MABEL's lift control loop"],
     [("MCU", "RP2040, dual Cortex-M0+ at 133 MHz"), ("Memory", "264 kB SRAM, 2 MB flash"),
      ("I/O", "26 GPIO, 3 × ADC, 2 × PIO blocks"), ("Interface", "Micro-USB")]),
    ("teensy41", "Teensy 4.1", "600 MHz real-time controller", 31.50,
     "When the loop has to close at 500 Hz across three CAN buses, this is the board that does it. "
     "MABEL uses two — one for the base, one for the arms, torso and neck.",
     ["Cortex-M7 at 600 MHz", "Three CAN buses, two of them CAN FD",
      "Ethernet with the add-on kit", "Two run MABEL's low-level control"],
     [("MCU", "i.MX RT1062, Cortex-M7 at 600 MHz"), ("Memory", "1 MB RAM, 8 MB flash"),
      ("Buses", "3 × CAN (2 × CAN FD), 8 × serial, 3 × SPI, 3 × I²C"),
      ("Timing", "Hardware-timed loops to 500 Hz+")]),
    ("bts7960", "BTS7960 Motor Driver", "43 A H-bridge for brushed DC", 9.99,
     "A big, dumb, reliable H-bridge. Drives the lift column's brushed motor from a Pico.",
     ["43 A continuous, brushed DC", "Isolated logic side",
      "Current sense output", "Drives MABEL's lift column"],
     [("Topology", "Dual half-bridge (BTS7960B)"), ("Current", "43 A continuous"),
      ("Supply", "5.5–27 V"), ("Control", "PWM, up to 25 kHz")]),
]:
    add(id=_mid, sku="MR-EL-" + _mid.upper(), cat="electronics", brand="MABEL Robotics",
        name=_nm, tagline=_tag, cost_usd=_c, cost_src="bom", src="vendor", family="pcb",
        art={"body": "pcb_green" if _mid == "pico" else "pcb_black", "w": 500, "h": 290},
        badge="In MABEL", tags=["mabel", "compute", "control"], summary=_sum, highlights=_hl,
        specs=S(("Specification", _sp)))

add(id="cable-usb-c-a", sku="MR-EL-USBCA", cat="electronics", brand="MABEL Robotics",
    name="USB-C to USB-A Cable, 4-pack", tagline="USB 3, 1 m, right-angle option",
    cost_usd=6.99, cost_src="bom", src="bom", family="cable_coil",
    art={"body": "plastic_bk", "c1": "alu_dark", "c2": "anod_black"},
    badge="In MABEL", tags=["mabel", "cameras", "usb"],
    summary="Four cameras, four cables. USB 3 rated, short enough not to coil, with a right-angle "
            "end so a wrist camera does not fight its own cable.",
    highlights=["USB 3.0, 5 Gbit/s — enough for a global-shutter stream",
                "1 m: no coil to manage", "Right-angle end available",
                "Head cam, two wrist cams and the base cam"],
    specs=S(("Cable", [("Standard", "USB 3.0, 5 Gbit/s"), ("Length", "1 m"),
                       ("Connectors", "USB-C to USB-A"), ("Shielding", "Braided + foil")])))

add(id="sleeving", sku="MR-EL-SLV", cat="electronics", brand="MABEL Robotics",
    name="Braided Cable Sleeving Set", tagline="6 mm and 12 mm, self-closing",
    cost_usd=8.99, cost_src="bom", src="bom", family="cable_coil",
    art={"body": "carbon", "c1": "anod_black", "c2": "anod_black"},
    badge="In MABEL", tags=["mabel", "harness"],
    summary="Self-closing braid in the two sizes a robot loom needs. Wraps an existing bundle "
            "without unplugging anything.",
    highlights=["Self-closing — wrap a finished loom", "6 mm and 12 mm, 5 m of each",
                "Cut with a hot knife, no fraying", "Abrasion resistant at joint pass-throughs"],
    specs=S(("Sleeving", [("Sizes", "6 mm and 12 mm"), ("Length", "5 m of each"),
                          ("Type", "Self-closing PET braid"),
                          ("Temperature", "−50 to 150 °C")])))

add(id="led-eyes", sku="MR-EL-EYES", cat="electronics", brand="MABEL Robotics",
    name="LED Matrix Eye Panels", tagline="A pair of animated 32 × 16 displays",
    cost_usd=39, cost_src="estimate", src="estimate", family="pcb",
    art={"body": "pcb_black", "w": 540, "h": 300, "usb": False},
    badge="In MABEL", tags=["mabel", "hri", "head"],
    summary="What makes a robot read as alive rather than switched on. A matched pair of LED "
            "matrices with a diffuser, driven over one SPI link, with the blink and saccade "
            "animations already written.",
    highlights=["Matched pair, 32 × 16 each", "Cast acrylic diffuser — pixels become an eye",
                "One SPI link drives both", "Open animation set: blink, saccade, squint, sleep"],
    specs=S(("Display", [("Resolution", "32 × 16 per eye"), ("Colour", "Single colour, 8-bit dim"),
                         ("Refresh", "200 Hz"), ("Diffuser", "Cast acrylic, 2 mm")]),
            ("Interface", [("Bus", "SPI, both panels on one chain"), ("Supply", "5 V, 1.2 A peak"),
                           ("Library", "Open source, Python and C")])))


# =================================================================== SENSORS ==
add(id="realsense-d405", sku="MR-SEN-D405", cat="sensors", brand="Intel",
    name="Intel RealSense D405", tagline="Short-range metric depth for the wrist",
    cost_usd=288, cost_src="bom", src="vendor", family="depth_camera",
    art={"body": "alu_dark", "w": 690, "h": 175},
    badge="In MABEL", tags=["mabel", "wrist", "depth", "global-shutter"],
    summary="A depth camera focused where manipulation actually happens: 7 to 50 cm from the "
            "gripper. Global shutter on both imagers, so a moving wrist does not smear the "
            "geometry it is about to grasp.",
    highlights=["Metric depth from 7 cm — most depth cameras start past the grasp",
                "Global shutter stereo pair at 1280 × 720, 90 fps",
                "No projector needed at close range",
                "Two of these are MABEL's maximum-tier wrist option"],
    specs=S(("Imaging", [("Depth resolution", "1280 × 720"), ("Depth frame rate", "Up to 90 fps"),
                         ("Shutter", "Global"), ("Range", "7–50 cm"),
                         ("Depth accuracy", "< 2% at 50 cm")]),
            ("Optics", [("Field of view", "87° × 58°"), ("RGB", "From the same stereo pair"),
                        ("Baseline", "18 mm")]),
            ("Interface", [("Connection", "USB 3.1 Gen 1, Type-C"),
                           ("SDK", "librealsense2, ROS 2 wrapper"), ("Mass", "62 g")])))

add(id="realsense-d435i", sku="MR-SEN-D435I", cat="sensors", brand="Intel",
    name="Intel RealSense D435i", tagline="Wide-field depth with an onboard IMU",
    cost_usd=319.72, cost_src="bom", src="vendor", family="depth_camera",
    art={"body": "alu_dark", "w": 700, "h": 180},
    tags=["head", "base", "depth", "imu"],
    summary="The general-purpose depth camera. Wide field of view, an IMU on the same clock as "
            "the imagers, and the range to see a room rather than a workspace.",
    highlights=["Depth to 10 m, 87° × 58° field of view",
                "Onboard IMU, hardware-synchronised to the frames",
                "IR projector for texture-poor surfaces",
                "MABEL's optional base camera for overhangs and table edges"],
    specs=S(("Imaging", [("Depth resolution", "1280 × 720"), ("Depth frame rate", "Up to 90 fps"),
                         ("Shutter", "Global (depth), rolling (RGB)"), ("Range", "0.3–10 m")]),
            ("Optics", [("Depth FOV", "87° × 58°"), ("RGB", "1920 × 1080 at 30 fps"),
                        ("Projector", "IR pattern")]),
            ("Interface", [("IMU", "6-axis, frame-synchronised"),
                           ("Connection", "USB 3.1 Gen 1, Type-C"), ("SDK", "librealsense2")])))

add(id="realsense-d455", sku="MR-SEN-D455", cat="sensors", brand="Intel",
    name="Intel RealSense D455", tagline="Long-baseline depth for navigation",
    cost_usd=419, cost_src="vendor", src="vendor", family="depth_camera",
    art={"body": "alu_dark", "w": 720, "h": 180},
    tags=["navigation", "depth", "imu"],
    summary="Twice the baseline of a D435i, so depth error at range falls by roughly a factor of "
            "four. The one to fit when the robot has to plan across a room.",
    highlights=["95 mm baseline — accurate depth out to 6 m",
                "RGB and depth share a field of view, so they align without a warp",
                "Onboard IMU", "Depth error under 2% at 4 m"],
    specs=S(("Imaging", [("Depth resolution", "1280 × 720"), ("Frame rate", "Up to 90 fps"),
                         ("Range", "0.6–6 m"), ("Depth error", "< 2% at 4 m")]),
            ("Optics", [("Baseline", "95 mm"), ("FOV", "87° × 58°, matched RGB and depth"),
                        ("RGB", "1280 × 800 global shutter")]),
            ("Interface", [("IMU", "6-axis"), ("Connection", "USB 3.1 Gen 1, Type-C")])))

add(id="wrist-cam-720", sku="MR-SEN-WR720", cat="sensors", brand="MABEL Robotics",
    name="Wrist Camera, 720p Global Shutter", tagline="AR0144 · 60 fps · 170° fisheye",
    cost_usd=48.99, cost_src="bom", src="bom", family="cam_module",
    badge="In MABEL", tags=["mabel", "wrist", "global-shutter", "imitation-learning"],
    summary="Eye-in-hand vision on a budget. A global-shutter AR0144 behind a 170° fisheye sees "
            "the whole grasp region from a wrist mount, and does not smear when the arm moves.",
    highlights=["Global shutter — the reason a moving wrist camera is usable at all",
                "170° fisheye keeps the object in frame through the approach",
                "UVC class: no driver, no SDK, opens as a webcam",
                "MABEL's essential-tier wrist camera"],
    specs=S(("Imaging", [("Sensor", "onsemi AR0144, 1/4 in"), ("Resolution", "1280 × 720"),
                         ("Frame rate", "60 fps"), ("Shutter", "Global"),
                         ("Field of view", "170° diagonal")]),
            ("Interface", [("Connection", "USB 2.0, UVC class"), ("Driver", "None — UVC"),
                           ("Mount", "M12 lens, 2 × M2 board mounts")])))

add(id="wrist-cam-1200", sku="MR-SEN-WR1200", cat="sensors", brand="MABEL Robotics",
    name="Wrist Camera, 1200p Global Shutter", tagline="AR0144 · 90 fps · the recommended wrist",
    cost_usd=82.99, cost_src="bom", src="bom", family="cam_module",
    art={"body": "pcb_black", "w": 420, "h": 420},
    badge="Recommended", tags=["mabel", "wrist", "global-shutter", "imitation-learning"],
    summary="The same board and sensor as the 720p camera, run at its full 1600 × 1200 and 90 fps. "
            "MABEL's build guide calls the step up to this camera the highest-value upgrade in the "
            "whole robot: wrist views carry the fine detail a manipulation policy learns from.",
    highlights=["1600 × 1200 at 90 fps, global shutter",
                "The detail a policy actually trains on",
                "Identical mounting and cabling to the 720p version",
                "UVC class — no driver"],
    specs=S(("Imaging", [("Sensor", "onsemi AR0144, 1/4 in"), ("Resolution", "1600 × 1200"),
                         ("Frame rate", "90 fps"), ("Shutter", "Global"),
                         ("Field of view", "170° diagonal")]),
            ("Interface", [("Connection", "USB 2.0, UVC class"), ("Driver", "None — UVC"),
                           ("Mount", "M12 lens, 2 × M2 board mounts")])))

add(id="head-cam-stereo", sku="MR-SEN-HEAD", cat="sensors", brand="MABEL Robotics",
    name="Stereo Head Camera, 1200p", tagline="Synchronised pair · 112° HFOV · 60 fps",
    cost_usd=97.99, cost_src="bom", src="bom", family="depth_camera",
    art={"body": "anod_black", "w": 680, "h": 175},
    badge="In MABEL", tags=["mabel", "head", "stereo", "global-shutter"],
    summary="A hardware-synchronised global-shutter stereo pair that hands you raw frames and "
            "leaves the matching to you. On a robot where the policy wants images rather than "
            "point clouds, that is the right trade.",
    highlights=["3200 × 1200 combined, 60 fps, hardware-synchronised",
                "112° horizontal field of view", "Global shutter on both imagers",
                "Matching runs on the host — costs memory, buys flexibility"],
    specs=S(("Imaging", [("Resolution", "3200 × 1200 combined"), ("Frame rate", "60 fps"),
                         ("Shutter", "Global, both imagers"), ("Synchronisation", "Hardware")]),
            ("Optics", [("Field of view", "112° horizontal"), ("Baseline", "60 mm")]),
            ("Interface", [("Connection", "USB 3.0, UVC"), ("Depth", "Host-side matching")])),
    note="Stereo matching on the host costs memory on a smaller Jetson. Budget for it on an 8 GB module.")

add(id="ego-camera-rig", sku="MR-SEN-EGO", cat="sensors", brand="MABEL Robotics",
    name="Egocentric Capture Rig", tagline="Head-mounted camera for human demonstrations",
    cost_usd=169, cost_src="estimate", src="estimate", family="ego_camera",
    tags=["teleop", "data-collection", "imitation-learning", "umi"],
    summary="Record demonstrations from the human's point of view, then train on them. A global-"
            "shutter wide-angle camera on an adjustable head mount, with a timestamped recorder "
            "that stays in sync with a gripper or glove.",
    highlights=["Human-perspective data collection — the UMI-style pipeline",
                "Global shutter, 1600 × 1200 at 60 fps, 150° field of view",
                "Hardware timestamps, so frames align with action logs",
                "Adjustable head mount that survives a full session"],
    specs=S(("Imaging", [("Resolution", "1600 × 1200"), ("Frame rate", "60 fps"),
                         ("Shutter", "Global"), ("Field of view", "150° diagonal")]),
            ("Capture", [("Timestamps", "Hardware, µs resolution"),
                         ("Storage", "Host-side, USB 3.0"),
                         ("Sync", "Trigger in/out for gripper and glove logs")]),
            ("Mount", [("Type", "Adjustable head harness"), ("Mass", "210 g with mount")])))

add(id="lidar-c1", sku="MR-SEN-C1", cat="sensors", brand="Slamtec",
    name="RPLIDAR C1", tagline="DTOF 2-D scanner · 12 m · 10 Hz",
    cost_usd=99, cost_src="bom", src="vendor", family="lidar",
    art={"body": "anod_black", "d": 400},
    badge="Recommended", tags=["mabel", "navigation", "slam", "2d-lidar"],
    summary="Direct time-of-flight, so accuracy holds at range instead of falling off the way "
            "triangulation does. This is the scanner MABEL's build guide recommends for mapping "
            "and Nav2.",
    highlights=["Direct time-of-flight — accurate at 12 m, not just at 3",
                "5 000 samples/s at 10 Hz", "Works in 40 klux — daylight through a window",
                "ROS 2 driver, maintained"],
    specs=S(("Scanning", [("Range", "0.05–12 m"), ("Sample rate", "5 000 /s"),
                          ("Scan rate", "8–12 Hz"), ("Method", "Direct time-of-flight"),
                          ("Angular resolution", "0.72°")]),
            ("Environment", [("Ambient light", "40 klux"), ("Mass", "110 g"),
                             ("Interface", "UART / USB adapter"), ("Supply", "5 V")])))

add(id="lidar-ld19", sku="MR-SEN-LD19", cat="sensors", brand="youyeetoo",
    name="FHL-LD19 Lidar", tagline="DTOF · 12 m · 50 g · the value pick",
    cost_usd=69, cost_src="bom", src="vendor", family="lidar",
    art={"body": "plastic_wh", "d": 370},
    tags=["navigation", "slam", "2d-lidar", "budget"],
    summary="A third of the price of the scanners it competes with, and direct time-of-flight "
            "rather than triangulation, so it holds accuracy at range better than its price "
            "suggests. Fifty grams.",
    highlights=["12 m DTOF for well under a hundred dollars", "50 g — mount it anywhere",
                "4 500 samples/s at 10 Hz", "ROS 2 SDK"],
    specs=S(("Scanning", [("Range", "0.02–12 m"), ("Sample rate", "4 500 /s"),
                          ("Scan rate", "10 Hz"), ("Method", "Direct time-of-flight")]),
            ("Environment", [("Ambient light", "30 klux"), ("Mass", "50 g"),
                             ("Interface", "UART"), ("Supply", "5 V")])))

add(id="lidar-mid360", sku="MR-SEN-M360", cat="sensors", brand="Livox",
    name="Livox Mid-360", tagline="360° × 59° 3-D lidar with built-in IMU",
    cost_usd=799, cost_src="vendor", src="vendor", family="lidar",
    art={"dome": True, "body": "anod_black", "d": 380},
    tags=["navigation", "slam", "3d-lidar"],
    summary="Full 3-D coverage around the robot in one small dome. Non-repetitive scanning means "
            "coverage keeps filling in the longer you dwell, which suits a robot that stops to "
            "work.",
    highlights=["360° horizontal, 59° vertical", "Non-repetitive scan — coverage improves with dwell time",
                "Built-in IMU for tightly-coupled odometry",
                "40 m range at 10% reflectivity"],
    specs=S(("Scanning", [("Field of view", "360° × 59°"), ("Range", "40 m at 10% reflectivity"),
                          ("Point rate", "200 000 points/s"),
                          ("Pattern", "Non-repetitive")]),
            ("Integration", [("IMU", "Built in, 200 Hz"), ("Interface", "Ethernet"),
                             ("Supply", "9–27 V"), ("Mass", "265 g")])))

add(id="imu-bno085", sku="MR-SEN-BNO", cat="sensors", brand="MABEL Robotics",
    name="BNO085 9-DOF IMU", tagline="Sensor fusion on the chip",
    cost_usd=22, cost_src="estimate", src="estimate", family="imu",
    art={"body": "pcb_blue"},
    tags=["imu", "orientation"],
    summary="An IMU that hands you an orientation instead of three raw vectors. The fusion runs on "
            "the sensor, so the host gets a stable quaternion at 100 Hz without spending a core "
            "on a filter.",
    highlights=["On-chip fusion — quaternion out, not raw counts",
                "Accelerometer, gyroscope and magnetometer",
                "Automatic gyro calibration in the background",
                "I²C, SPI or UART-RVC"],
    specs=S(("Sensing", [("Axes", "9 — accel, gyro, magnetometer"),
                         ("Output rate", "100 Hz fused"),
                         ("Orientation accuracy", "2.0° dynamic, 1.0° static"),
                         ("Gyro range", "±2 000 °/s")]),
            ("Interface", [("Buses", "I²C · SPI · UART-RVC"), ("Supply", "3.3 V"),
                           ("Reports", "Rotation vector, linear accel, gravity, step, tap")])))

add(id="imu-tactical", sku="MR-SEN-IMUT", cat="sensors", brand="MABEL Robotics",
    name="Industrial-Grade IMU", tagline="0.5 °/h bias stability · for state estimation",
    cost_usd=1180, cost_src="estimate", src="estimate", family="imu",
    art={"body": "pcb_black"},
    tags=["imu", "navigation", "slam"],
    summary="When drift is the thing limiting your odometry, the fix is not a better filter — it "
            "is a better gyro. Two orders of magnitude less bias instability than a consumer part.",
    highlights=["0.5 °/h in-run bias stability", "Factory temperature-calibrated over the full range",
                "Aligned and characterised axes, with the coefficients on the unit",
                "Fits a tightly-coupled lidar-inertial stack"],
    specs=S(("Performance", [("Gyro bias instability", "0.5 °/h"),
                             ("Angular random walk", "0.15 °/√h"),
                             ("Accel bias instability", "15 µg"),
                             ("Output rate", "Up to 1 kHz")]),
            ("Interface", [("Buses", "RS-422 · SPI"), ("Supply", "5 V"),
                           ("Calibration", "Factory, −40 to 85 °C, coefficients on unit")])))

add(id="ft-sensor", sku="MR-SEN-FT6", cat="sensors", brand="MABEL Robotics",
    name="6-Axis Force/Torque Sensor", tagline="Wrist-mounted, 1 kHz",
    cost_usd=1450, cost_src="estimate", src="estimate", family="imu",
    art={"body": "pcb_black"},
    tags=["force", "manipulation", "contact"],
    summary="Three forces and three torques at the wrist, a thousand times a second. What turns "
            "position control into force control, and a rigid arm into one that can lean on "
            "something without breaking it.",
    highlights=["Fx, Fy, Fz, Tx, Ty, Tz at 1 kHz", "Temperature compensated in hardware",
                "Overload stops built into the structure",
                "Mounts between the arm flange and the hand"],
    specs=S(("Ranges", [("Fx, Fy", "±200 N"), ("Fz", "±400 N"), ("Tx, Ty", "±10 N·m"),
                        ("Tz", "±10 N·m"), ("Resolution", "0.05 N / 0.002 N·m")]),
            ("Interface", [("Output rate", "1 kHz"), ("Bus", "EtherCAT · CAN · RS-485"),
                           ("Supply", "24 V"), ("Overload", "Mechanical stops at 300% range")])))

add(id="tactile-fingertip", sku="MR-SEN-TACT", cat="sensors", brand="MABEL Robotics",
    name="Tactile Fingertip Sensor", tagline="Normal and shear sensing under a silicone pad",
    cost_usd=248, cost_src="estimate", src="estimate", family="imu",
    art={"body": "pcb_blue"},
    tags=["tactile", "orca", "hand", "manipulation"],
    summary="Contact sensing where contact happens. A magnetic taxel array under a cast silicone "
            "pad reads normal and shear force across the fingertip — enough to detect the moment "
            "an object starts to slip.",
    highlights=["Normal and shear across a 4 × 4 taxel array",
                "Slip detection at 200 Hz", "Silicone pad is a wear part — replaceable",
                "Fits the ORCA fingertip"],
    specs=S(("Sensing", [("Array", "4 × 4 taxels"), ("Axes per taxel", "Normal + 2 shear"),
                         ("Range", "0–10 N normal"), ("Resolution", "0.01 N"),
                         ("Output rate", "200 Hz")]),
            ("Physical", [("Pad", "Cast silicone, Shore A20, replaceable"),
                          ("Interface", "I²C"), ("Fitment", "ORCA fingertip")])))

add(id="encoder-as5047", sku="MR-SEN-AS5047", cat="sensors", brand="MABEL Robotics",
    name="AS5047P Magnetic Encoder", tagline="14-bit on-axis absolute",
    cost_usd=14, cost_src="estimate", src="estimate", family="imu",
    art={"body": "pcb_green"},
    tags=["encoder", "foc", "joint"],
    summary="The encoder inside most home-built FOC drives. Fourteen bits of absolute angle at up "
            "to 28 000 rpm, with the magnet and mount included so the air gap is right.",
    highlights=["14-bit absolute — 16 384 counts per revolution",
                "Dynamic angle error compensation up to 28 000 rpm",
                "SPI, ABI or PWM output", "Diametric magnet and spacer included"],
    specs=S(("Sensing", [("Resolution", "14-bit absolute"), ("Max speed", "28 000 rpm"),
                         ("Air gap", "0.5–2.5 mm"), ("Accuracy", "±0.17° with compensation")]),
            ("Interface", [("Outputs", "SPI · ABI incremental · PWM · UVW"),
                           ("Supply", "3.3 or 5 V"), ("Includes", "Diametric magnet, mount")])))

# =================================================================== COMPUTE ==
for _cid, _nm, _tag, _c, _badge, _sum, _hl, _sp in [
    ("jetson-orin-nano", "Jetson Orin Nano Super", "8 GB · 67 TOPS · developer kit", 399, "In MABEL",
     "The entry point, and the module MABEL's essential build uses. The carrier also accepts Orin NX "
     "modules, so it is a route to 16 GB later rather than a dead end.",
     ["67 TOPS at 8 GB", "Carrier accepts Orin NX modules — upgrade without a new board",
      "15–25 W", "MABEL's essential-tier compute"],
     [("Module", "Jetson Orin Nano 8 GB"), ("AI performance", "67 TOPS (INT8)"),
      ("GPU", "1 024-core Ampere, 32 tensor cores"), ("CPU", "6-core Arm Cortex-A78AE"),
      ("Memory", "8 GB LPDDR5, 102 GB/s"), ("Power", "7–25 W")]),
    ("jetson-orin-nx16", "Jetson Orin NX 16 GB + Carrier", "16 GB · 157 TOPS · recommended", 1249,
     "Recommended",
     "Memory, not TOPS, is what binds a robot's compute. The policy, the visual SLAM front end, the "
     "planner and every camera stream have to be resident at once — and the module is soldered, so "
     "you choose this on day one or you buy it twice.",
     ["16 GB — the constraint that actually binds", "157 TOPS", "Carrier included",
      "MABEL's recommended tier"],
     [("Module", "Jetson Orin NX 16 GB"), ("AI performance", "157 TOPS (INT8)"),
      ("GPU", "1 024-core Ampere, 32 tensor cores"), ("CPU", "8-core Arm Cortex-A78AE"),
      ("Memory", "16 GB LPDDR5, 102 GB/s"), ("Power", "10–25 W")]),
    ("jetson-agx-orin", "Jetson AGX Orin 64 GB", "64 GB · 275 TOPS · developer kit", 3499, "",
     "The development machine that emulates every smaller Orin module, so you can profile on it and "
     "deploy down. Sixty watts, which on a battery-powered robot means a power system designed for it.",
     ["64 GB and 275 TOPS", "Emulates every Orin module for profiling",
      "60 W — plan the power system around it", "12 lanes of camera input"],
     [("Module", "Jetson AGX Orin 64 GB"), ("AI performance", "275 TOPS (INT8)"),
      ("GPU", "2 048-core Ampere, 64 tensor cores"), ("CPU", "12-core Arm Cortex-A78AE"),
      ("Memory", "64 GB LPDDR5, 204.8 GB/s"), ("Power", "15–60 W")]),
    ("jetson-thor", "Jetson AGX Thor", "128 GB · 2 070 TFLOPS · developer kit", 5499, "",
     "Blackwell-class compute on a robot. This is what running a large vision-language-action model "
     "on board actually costs — and on MABEL's own bill of materials, this single line is the "
     "difference between an $8.5k robot and a $15k one.",
     ["2 070 TFLOPS (FP4) — VLA models on board", "128 GB unified memory",
      "Blackwell GPU architecture", "The maximum tier, and priced like it"],
     [("Module", "Jetson AGX Thor"), ("AI performance", "2 070 TFLOPS (FP4)"),
      ("GPU", "Blackwell architecture"), ("CPU", "14-core Arm Neoverse-V3AE"),
      ("Memory", "128 GB LPDDR5X, 273 GB/s"), ("Power", "40–130 W")]),
]:
    add(id=_cid, sku="MR-CMP-" + _cid.split("jetson-")[1].upper().replace("-", ""), cat="compute",
        brand="NVIDIA", name=_nm, tagline=_tag, cost_usd=_c, cost_src="bom", src="vendor",
        family="compute", art={"body": "anod_black"}, badge=_badge,
        tags=["mabel", "jetson", "edge-ai"], summary=_sum, highlights=_hl,
        specs=S(("Compute", _sp), ("I/O", [("Networking", "1 × GbE (2.5 GbE on AGX)"),
                                           ("Storage", "M.2 NVMe"), ("USB", "USB 3.2 Type-A and Type-C"),
                                           ("Camera", "MIPI CSI-2")])),
        note="NVIDIA raised Jetson prices on 22 July 2026. This is the current price, not the "
             "figure in older bills of materials." if _cid in ("jetson-orin-nano", "jetson-thor") else "")

add(id="pi5", sku="MR-CMP-PI5", cat="compute", brand="Raspberry Pi",
    name="Raspberry Pi 5, 8 GB", tagline="For the parts of the robot that are not the policy",
    cost_usd=80, cost_src="vendor", src="vendor", family="compute",
    art={"body": "anod_grey"},
    tags=["compute", "aux"],
    summary="Not the machine that runs the policy — the one that runs the screen, the audio, the "
            "housekeeping and the web interface, so the Jetson's memory stays where it belongs.",
    highlights=["Quad Cortex-A76 at 2.4 GHz", "PCIe 2.0 for NVMe",
                "Two 4Kp60 display outputs", "Offloads HRI and housekeeping from the Jetson"],
    specs=S(("Compute", [("CPU", "Quad-core Cortex-A76 at 2.4 GHz"), ("Memory", "8 GB LPDDR4X"),
                         ("GPU", "VideoCore VII")]),
            ("I/O", [("Networking", "Gigabit Ethernet, Wi-Fi 5"), ("USB", "2 × USB 3.0, 2 × USB 2.0"),
                     ("Expansion", "PCIe 2.0 ×1, 40-pin GPIO"), ("Display", "2 × micro-HDMI 4Kp60")])))

add(id="nvme-2tb", sku="MR-CMP-NVME2", cat="compute", brand="MABEL Robotics",
    name="NVMe SSD, 2 TB", tagline="For episode data, not for the OS",
    cost_usd=118, cost_src="vendor", src="vendor", family="compute",
    art={"body": "anod_grey"},
    tags=["storage", "data-collection"],
    summary="Demonstration data fills a disk faster than anyone expects — four camera streams plus "
            "joint states is roughly a gigabyte a minute. This is the drive that keeps a session "
            "going.",
    highlights=["2 TB, PCIe 4.0", "7 000 MB/s read, 6 000 MB/s write",
                "Fits the Jetson carrier's M.2 slot", "Around 30 hours of four-camera episodes"],
    specs=S(("Drive", [("Capacity", "2 TB"), ("Interface", "PCIe 4.0 ×4, NVMe 1.4"),
                       ("Sequential read", "7 000 MB/s"), ("Sequential write", "6 000 MB/s"),
                       ("Endurance", "1 200 TBW"), ("Form factor", "M.2 2280")])))

add(id="training-workstation", sku="MR-CMP-WS", cat="compute", brand="MABEL Robotics",
    name="Training Workstation", tagline="RTX 5090 · 128 GB · built for policy training",
    cost_usd=5400, cost_src="estimate", src="estimate", family="compute",
    art={"body": "anod_black"},
    tags=["training", "workstation"],
    summary="The other half of the robot. Built and burned in for visuomotor policy training — "
            "enough VRAM for large batches of image observations, enough system memory to keep a "
            "dataset in page cache, and quiet enough to sit in a lab.",
    highlights=["RTX 5090, 32 GB VRAM", "128 GB ECC system memory",
                "4 TB NVMe scratch plus 8 TB dataset storage",
                "Ships with CUDA, PyTorch and the MABEL training stack installed"],
    specs=S(("Compute", [("GPU", "NVIDIA RTX 5090, 32 GB GDDR7"),
                         ("CPU", "16-core, 5.4 GHz boost"), ("Memory", "128 GB DDR5 ECC")]),
            ("Storage", [("Scratch", "4 TB NVMe PCIe 5.0"), ("Dataset", "8 TB NVMe")]),
            ("Software", [("Preinstalled", "Ubuntu 24.04, CUDA, PyTorch, MABEL training stack"),
                          ("Warranty", "3 years, parts and labour")])))

# ===================================================================== TOOLS ==
for _tid, _nm, _tag, _c, _sum, _hl, _sp in [
    ("hoto-precision-24", "HOTO 24-in-1 Precision Screwdriver", "Aluminium body · S2 steel bits", 26,
     "The driver that lives on the bench. A knurled aluminium handle with a spinning cap, and "
     "twenty-four S2 bits in the sizes small robots actually use.",
     ["24 S2 steel bits, magnetised", "Spinning end cap for fine work",
      "Aluminium handle, knurled", "Magnetic bit storage in the base"],
     [("Bits", "24, S2 tool steel"), ("Sizes", "PH, SL, TRX, HEX, Y, U, pentalobe"),
      ("Handle", "CNC aluminium, knurled"), ("Torque", "Up to 3 N·m by hand")]),
    ("hoto-electric-driver", "HOTO Electric Precision Screwdriver", "3 torque settings · 60 bits", 54,
     "Assembling a robot means several hundred M3 screws. This does them at a consistent torque "
     "without wearing out your wrist, and still turns by hand for the last quarter turn.",
     ["Three torque settings, 0.1–0.3 N·m", "60-bit set included",
      "Manual override — finish by feel", "USB-C, 2 hours to full"],
     [("Torque settings", "3 (0.1 / 0.2 / 0.3 N·m)"), ("Speed", "200 rpm"),
      ("Battery", "350 mAh, USB-C"), ("Bits", "60, S2 steel"), ("Light", "Dual LED ring")]),
    ("hoto-ratchet-48", "HOTO 48-in-1 Ratchet Wrench Set", "72-tooth ratchet · sockets and bits", 42,
     "For everything larger than a precision driver: extrusion bolts, wheel hubs, battery "
     "terminals. A 72-tooth ratchet needs only five degrees of swing, which matters inside a frame.",
     ["72-tooth ratchet — 5° working swing", "Sockets and bits, 48 pieces",
      "Chrome-vanadium", "Moulded case that closes when a piece is missing"],
     [("Ratchet", "72 tooth, 5° swing, 1/4 in drive"), ("Pieces", "48"),
      ("Material", "Chrome-vanadium steel"), ("Sockets", "4–14 mm")]),
    ("hoto-laser-measure", "HOTO Laser Distance Meter", "40 m · ±2 mm", 38,
     "Laying out a workspace, checking a mount height, measuring a room before you map it.",
     ["40 m range, ±2 mm", "Area and volume modes", "Backlit display", "USB-C charging"],
     [("Range", "0.05–40 m"), ("Accuracy", "±2 mm"), ("Modes", "Distance, area, volume, continuous"),
      ("Battery", "USB-C rechargeable")]),
    ("crimper-kit", "Ratcheting Crimp Tool Kit", "JST, Dupont, ferrule jaws", 62,
     "Three jaw sets and one ratcheting frame. A crimp that is not ratcheted is a crimp that will "
     "come apart in a cable chain six months from now.",
     ["Ratcheting frame — consistent, complete crimps",
      "Jaws for JST-GH, JST-XH/Dupont and ferrules", "Adjustable crimp depth",
      "Case with room for the contacts"],
     [("Frame", "Ratcheting, releasable"), ("Jaws", "3 sets — JST-GH, XH/Dupont, ferrule"),
      ("Range", "0.03–6 mm²"), ("Adjustment", "Crimp depth, 4 positions")]),
    ("caliper-digital", "Digital Calipers, 150 mm", "±0.02 mm · IP54", 34,
     "Measuring a bore before you order a bearing. Stainless jaws, absolute encoder, and it does "
     "not lose zero when you close it.",
     ["±0.02 mm over 150 mm", "Absolute encoder — no re-zero at power-on",
      "IP54, survives swarf and coolant", "Metric and imperial, with a fraction mode"],
     [("Range", "0–150 mm"), ("Resolution", "0.01 mm"), ("Accuracy", "±0.02 mm"),
      ("Protection", "IP54"), ("Material", "Hardened stainless")]),
]:
    add(id=_tid, sku="MR-TL-" + _tid.split("-")[1].upper()[:5], cat="tools",
        brand="HOTO" if _tid.startswith("hoto") else "MABEL Robotics",
        name=_nm, tagline=_tag, cost_usd=_c, cost_src="estimate", src="vendor",
        family="tool_kit",
        art={"body": "alu" if "hoto" in _tid else "anod_grey",
             "handle": "anod_black" if "electric" in _tid else "alu_dark"},
        tags=["tools", "assembly"], summary=_sum, highlights=_hl,
        specs=S(("Specification", _sp)))


# ==================================================================== ROBOTS ==
_MABEL_SPECS = S(
    ("Mobility", [("Base", "3 × independent swerve modules"),
                  ("Motion", "Holonomic — any heading, any facing, simultaneously"),
                  ("Top speed", "1.5 m/s"),
                  ("Payload on base", "20 kg above the drive plate")]),
    ("Manipulation", [("Arms", "2 × 7-DOF, OpenArm-derived"),
                      ("Hands", "2 × 17-DOF ORCA, tendon driven"),
                      ("Actuators", "DAMIAO DM8009P, DM4340 and DM-J4310 joints"),
                      ("Hand actuators", "34 × Feetech HL-series bus servos"),
                      ("Total functional DOF", "56"),
                      ("Motors on board", "59")]),
    ("Workspace", [("Lift column", "0–635 mm, three stage"),
                   ("Torso pitch", "DAMIAO DM10422P, 400 N·m"),
                   ("Reach", "Floor to counter height")]),
    ("Perception", [("Head", "3-DOF active mount, global-shutter stereo pair, 112° HFOV"),
                    ("Wrists", "2 × global-shutter eye-in-hand cameras"),
                    ("Navigation", "2-D DTOF lidar, 12 m"),
                    ("Proprioception", "Dual encoders on every arm joint")]),
    ("Compute & buses", [("Onboard compute", "NVIDIA Jetson, Orin Nano through AGX Thor"),
                         ("Real-time control", "2 × Teensy 4.1 at 500 Hz"),
                         ("Actuator buses", "3 × CAN for arms, torso and neck; TTL per hand"),
                         ("Network", "2.5 GbE onboard spine"),
                         ("Software", "ROS 2 Jazzy, MuJoCo and Isaac Lab twins")]),
    ("Interaction", [("Display", "13 in body touchscreen"),
                     ("Expression", "Animated LED-matrix eyes"),
                     ("Audio", "Speaker and microphone"),
                     ("Teleoperation", "Apple Vision Pro spatial app, with automatic episode logging")]),
    ("Power", [("Battery", "2 × 24 V Li-ion packs"),
               ("Runtime", "≈ 90 min mixed driving and manipulation"),
               ("Safety", "Hardware e-stop, de-energises actuators independently of the host")]),
)

add(id="mabel-kit", sku="MR-ROB-KIT", cat="robots", brand="MABEL Robotics",
    name="MABEL Developer Kit", tagline="Every part, every file, and the build guide",
    cost_usd=15000, price=15000, cost_src="quote", src="bom", family="mabel",
    badge="Build it yourself", stock="made-to-order",
    tags=["mabel", "robot", "kit", "research"],
    summary="A complete mobile bimanual research robot, in parts. Every actuator, every machined "
            "and printed component, every cable and connector, the compute, the sensors — sorted "
            "into labelled subsystem boxes and shipped with the build guide, the CAD, the firmware "
            "and the simulation model. You assemble it, and in doing so you learn the machine "
            "well enough to modify it.",
    highlights=["Every part for a 56-DOF mobile bimanual robot, sorted by subsystem",
                "Illustrated build guide, plus CAD, firmware, ROS 2 stack and MuJoCo twin",
                "Structural parts arrive machined and printed — no fabrication needed",
                "Swerve modules ship assembled and tested; you build the rest",
                "Two build sessions of remote support included"],
    specs=_MABEL_SPECS,
    note="Assembly takes roughly 60–80 hours for someone comfortable with mechanical assembly and "
         "a soldering iron. Compute tier is chosen at checkout.")

add(id="mabel-assembled", sku="MR-ROB-ASM", cat="robots", brand="MABEL Robotics",
    name="MABEL, Assembled", tagline="Built, calibrated, tested — and it drives out of the crate",
    cost_usd=25000, price=25000, cost_src="quote", src="bom", family="mabel",
    badge="Ready to run", stock="made-to-order",
    tags=["mabel", "robot", "assembled", "research"],
    summary="The same robot, built by the people who designed it. Every joint is calibrated, every "
            "camera is intrinsically and extrinsically calibrated, the arms are zeroed against the "
            "kinematic model, and the whole machine is run through a driving, manipulation and "
            "teleoperation acceptance test before it is crated. Unpack it, charge it, and start "
            "collecting data the same day.",
    highlights=["Assembled, wired and calibrated — kinematics, cameras, encoders",
                "Acceptance-tested: drive, manipulate, teleoperate, record",
                "Ships in a reusable flight case with the tool roll",
                "Apple Vision Pro teleoperation app configured to your account",
                "One year of hardware support, plus a half-day onboarding session"],
    specs=_MABEL_SPECS,
    note="Lead time is 8–10 weeks from order. Compute tier and camera tier are chosen at checkout.")

add(id="mabel-arm", sku="MR-ROB-ARM", cat="robots", brand="MABEL Robotics",
    name="MABEL Arm", tagline="One 7-DOF arm, assembled and calibrated",
    cost_usd=4200, cost_src="estimate", price=4299, src="estimate", family="hand",
    art={"body": "plastic_wh"}, stock="made-to-order",
    tags=["mabel", "arm", "openarm", "research"],
    summary="A single 7-DOF arm from the MABEL platform, on a bench stand. The same joints, the "
            "same harness and the same control stack as the full robot — for labs that need "
            "manipulation research without the mobile base.",
    highlights=["7 DOF, OpenArm geometry, DAMIAO joints with dual encoders",
                "Bench stand and 24 V supply included",
                "Calibrated against the published kinematic model",
                "Runs the same ROS 2 stack and MuJoCo model as MABEL"],
    specs=S(("Kinematics", [("Degrees of freedom", "7"), ("Reach", "0.85 m"),
                            ("Payload", "3 kg at full extension")]),
            ("Actuation", [("Shoulder", "2 × DAMIAO DM8009P, 40 N·m"),
                           ("Roll and elbow", "2 × DAMIAO DM4340, 9 N·m"),
                           ("Wrist", "3 × DAMIAO DM-J4310"),
                           ("Feedback", "Dual encoders on every joint")]),
            ("Interfaces", [("Bus", "CAN, 1 Mbit/s"), ("Supply", "24 V DC, included"),
                            ("Control", "MIT impedance mode, 500 Hz"),
                            ("Software", "ROS 2 Jazzy, MuJoCo model")])))

add(id="orca-hand-pair", sku="MR-ROB-HAND", cat="robots", brand="MABEL Robotics",
    name="ORCA Hands, Pair", tagline="2 × 17-DOF tendon-driven hands, assembled",
    cost_usd=2400, cost_src="estimate", price=2499, src="estimate", family="hand",
    art={"body": "plastic_wh"}, stock="made-to-order",
    tags=["mabel", "orca", "hand", "dexterous"],
    summary="Two seventeen-degree-of-freedom tendon-driven hands, built, tendoned and tensioned. "
            "Building a hand is the fiddliest part of a bimanual robot; this is that job already "
            "done, with the tendons run in and the servos addressed.",
    highlights=["17 DOF each — 16 finger joints plus a wrist",
                "34 Feetech bus servos, addressed and tested",
                "Dyneema tendons run in and tensioned",
                "Silicone fingertip pads, replaceable"],
    specs=S(("Kinematics", [("Degrees of freedom", "17 per hand"),
                            ("Fingers", "4 + opposed thumb"),
                            ("Actuation", "Tendon driven, Dyneema SK99")]),
            ("Actuation", [("Finger servos", "16 × Feetech HL3915M per hand"),
                           ("Wrist servo", "1 × Feetech HL3930M per hand"),
                           ("Bus", "TTL, 1 Mbit/s, one chain per hand")]),
            ("Physical", [("Fingertips", "Cast silicone, Shore A20, replaceable"),
                          ("Mount", "MABEL / OpenArm wrist flange"),
                          ("Supply", "12 V per hand")])))


# ================================================================== FACETS ===
# Machine-readable attributes for the actuator finder (actuators.html). The
# prose specs above are for reading; these are for filtering, and they must
# agree with them.
#
# `None` means WE HAVE NOT PUBLISHED THAT FIGURE — not zero, and not "any". The
# finder shows those as "—" and tells you how many products it had to set aside
# when you narrow that axis, rather than quietly dropping them. Several of these
# are peak-only because the vendor publishes peak only; inventing a nominal
# figure to fill a column is exactly the kind of thing this catalogue does not do.
#
#   nom     rated / continuous torque, N·m
#   peak    peak torque, N·m
#   volts   nominal supply, V DC
#   frame   outer diameter or NEMA frame across flats, mm
#   gear    planetary | harmonic | none | leadscrew
#   bus     CAN | RS-485 | TTL | step/dir
#   mass    g
FACETS = {
    "damiao-dm-j4310":      dict(nom=3.5,  peak=10,   volts=24, frame=43,  gear="planetary", bus="CAN",      mass=300,  ratio="10:1"),
    "damiao-dm4340":        dict(nom=9,    peak=27,   volts=24, frame=43,  gear="planetary", bus="CAN",      mass=None, ratio="planetary"),
    "damiao-dm8009p":       dict(nom=None, peak=40,   volts=24, frame=80,  gear="planetary", bus="CAN",      mass=None, ratio="planetary"),
    "damiao-dm10422p":      dict(nom=400,  peak=None, volts=48, frame=104, gear="planetary", bus="CAN",      mass=None, ratio="hollow-shaft"),
    "unitree-go-m8010-6":   dict(nom=None, peak=23.7, volts=24, frame=80,  gear="planetary", bus="RS-485",   mass=485,  ratio="6.33:1"),
    "unitree-a1":           dict(nom=None, peak=33.5, volts=24, frame=88,  gear="planetary", bus="RS-485",   mass=605,  ratio="9.1:1"),
    "xiaomi-cybergear-rs01":dict(nom=4,    peak=12,   volts=24, frame=60,  gear="planetary", bus="CAN",      mass=317,  ratio="7.75:1"),
    "xiaomi-cybergear-rs03":dict(nom=None, peak=60,   volts=48, frame=90,  gear="planetary", bus="CAN",      mass=None, ratio="planetary"),
    "eyou-phu17h-80":       dict(nom=None, peak=None, volts=48, frame=None,gear="harmonic",  bus="CAN",      mass=None, ratio="101:1"),
    "eyou-phu20h-100":      dict(nom=None, peak=None, volts=48, frame=None,gear="harmonic",  bus="CAN",      mass=None, ratio="100:1"),
    # Bus servos are specified in kg·cm; 1 kg·cm = 0.0981 N·m.
    "feetech-hl3915m":      dict(nom=1.37, peak=None, volts=12, frame=None,gear="planetary", bus="TTL",      mass=None, ratio="steel gear"),
    "feetech-hl3930m":      dict(nom=3.43, peak=None, volts=12, frame=None,gear="planetary", bus="TTL",      mass=None, ratio="metal case"),
    "feetech-sts3215":      dict(nom=2.94, peak=None, volts=12, frame=None,gear="planetary", bus="TTL",      mass=None, ratio="metal gear"),
    "dynamixel-xc330":      dict(nom=0.92, peak=None, volts=12, frame=20,  gear="planetary", bus="TTL",      mass=23,   ratio="181:1"),
    "nema17-foc":           dict(nom=0.45, peak=None, volts=24, frame=42,  gear="none",      bus="step/dir", mass=None, ratio="direct"),
    "nema23-foc":           dict(nom=1.9,  peak=None, volts=48, frame=57,  gear="none",      bus="step/dir", mass=None, ratio="direct"),
    "lift-column":          dict(nom=None, peak=None, volts=24, frame=None,gear="leadscrew", bus=None,       mass=None, ratio="3-stage"),
    "planetary-gearbox-n17":dict(nom=3,    peak=None, volts=None,frame=42, gear="planetary", bus=None,       mass=260,  ratio="5:1 / 10:1 / 27:1"),
}

for _p in P:
    _p["facets"] = FACETS.get(_p["id"], {})
