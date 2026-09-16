#!/usr/bin/env python3
"""Generate the Under Five Register mockup: concept model + mock data.

Produces under-five-register-model.json and under-five-register-mock-data.json
in the same directory. The model mirrors the Sierra Leone IMCI
"UNDER FIVE REGISTER FOR PHUs: AGE 2 MONTH-5 YEARS" (Google Sheet
16weLQ8mLfLGbEnXNnbTwuV525s9yFNIL, CSV at /tmp/opencode/register2.csv).
"""
import json
import os

OUT_DIR = os.path.dirname(os.path.abspath(__file__))

REUSED_CONCEPTS = {
    "Yes": "1065AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    "No": "1066AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    "New": "1bfff36f-5ee3-4c22-ba99-5b981649ea30",
    "Follow up": "ce10f985-03ae-44c7-a63e-ec5fa7aae3c5",
    "In Facility": "cdc75415-678d-42ee-8d04-fe2404b6eb08",
    "Outreach": "a27dc8c2-28df-4d93-abce-ec7e37a81907",
}

YN = ["Yes", "No"]

NEW_ANSWERS = [
    "Male", "Female",
    "N/A",
    "Physical", "Visual", "Speech", "Hearing", "Learning", "Multiple",
    "Normal", "Slowly", "Very slowly",
    "Not Done", "Negative", "Positive",
    "Up to date", "Not up to date", "Unknown",
    "Completed", "Not started",
    "6-11 months", "12-23 months", "24-59 months",
    "< 6 months", ">= 6 months",
    "< 11.5 cm", "11.5 - 12.5 cm", ">= 12.5 cm",
    "< -3", "-3 to -2", ">= -2",
    "No pallor", "Palmar pallor", "Severe palmar pallor",
    "Pneumonia / Fever", "Watery diarrhoea / Dysentery", "Malaria",
    "Anaemia", "Severe Malnutrition", "No classification",
    "Pass", "Fail",
    "Treated within 24 hrs of onset", "Treated after 24 hrs of onset",
    "Improved", "The same", "Worse", "Died",
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]

# name: (datatype, [answer names])  -- answers None for free-text/numeric/date
QUESTIONS = [
    ("Age in months", "Numeric", None),
    ("Sex (M/F)", "Coded", ["Male", "Female"]),
    ("Chiefdom / Village", "Text", None),
    ("Screened for disability", "Coded", YN),
    ("Disability present", "Coded", ["Yes", "No", "N/A"]),
    ("Disability type", "Coded", ["Physical", "Visual", "Speech", "Hearing", "Learning", "Multiple"]),
    ("Temperature (C)", "Numeric", None),
    ("Weight (kg)", "Numeric", None),
    ("Height / Length (cm)", "Numeric", None),
    ("MUAC (cm)", "Numeric", None),
    ("WHZ score", "Numeric", None),
    ("WAZ score", "Numeric", None),
    ("Presenting complaint", "Text", None),
    ("Exclusive breastfeeding (child < 6 months)", "Coded", YN),
    ("Continued breastfeeding (child 6-23 months)", "Coded", YN),
    ("Type of visit (new / follow-up)", "Coded", ["New", "Follow up"]),
    ("Service point (in facility / outreach)", "Coded", ["In Facility", "Outreach"]),
    ("District", "Text", None),
    ("Facility Name", "Text", None),
    ("Facility Type", "Text", None),
    ("Chiefdom / Zone", "Text", None),
    ("Register Year", "Numeric", None),
    ("Register Month", "Coded", ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]),
    ("Unable to drink or breastfeed", "Coded", YN),
    ("Vomiting everything", "Coded", YN),
    ("History of convulsion", "Coded", YN),
    ("Convulsing now", "Coded", YN),
    ("Lethargic or unconscious", "Coded", YN),
    ("Oxygen saturation (%)", "Numeric", None),
    ("Skin pinch", "Coded", ["Normal", "Slowly", "Very slowly"]),
    ("Cough or difficult breathing", "Coded", YN),
    ("Duration of cough (days)", "Numeric", None),
    ("Respiratory rate (per minute)", "Numeric", None),
    ("Chest indrawing", "Coded", YN),
    ("Stridor present", "Coded", YN),
    ("Diarrhoea", "Coded", YN),
    ("Duration of diarrhoea (days)", "Numeric", None),
    ("Blood in stool", "Coded", YN),
    ("Sunken eyes", "Coded", YN),
    ("Weak to drink", "Coded", YN),
    ("Eager / thirsty drinking", "Coded", YN),
    ("Skin pinch goes back slowly", "Coded", YN),
    ("Fever", "Coded", YN),
    ("Measles in last 3 months", "Coded", YN),
    ("Generalized rash of measles", "Coded", YN),
    ("Cough / runny nose / red eyes", "Coded", YN),
    ("Mouth ulcer / pus draining eyes / corneal clouding", "Coded", YN),
    ("Palmar pallor", "Coded", ["No pallor", "Palmar pallor", "Severe palmar pallor"]),
    ("Ear problem", "Coded", YN),
    ("Ear pain", "Coded", YN),
    ("Ear discharge", "Coded", YN),
    ("Visible severe wasting", "Coded", YN),
    ("Pitting oedema of both feet", "Coded", YN),
    ("MUAC category", "Coded", ["< 11.5 cm", "11.5 - 12.5 cm", ">= 12.5 cm"]),
    ("WHZ category", "Coded", ["< -3", "-3 to -2", ">= -2"]),
    ("HIV RDT result", "Coded", ["Not Done", "Negative", "Positive"]),
    ("HIV microscopy result", "Coded", ["Not Done", "Negative", "Positive"]),
    ("Immunisation up to date", "Coded", ["Up to date", "Not up to date", "Unknown"]),
    ("Immunisation age band", "Coded", ["< 6 months", ">= 6 months"]),
    ("Albendazole status", "Coded", ["Completed", "Not started", "Unknown"]),
    ("Vitamin A dose band", "Coded", ["6-11 months", "12-23 months", "24-59 months"]),
    ("Vitamin A received within last 6 months", "Coded", YN),
    ("Albendazole received within last 6 months", "Coded", YN),
    ("Other problems", "Text", None),
    ("Disease classification", "Coded", ["Pneumonia / Fever", "Watery diarrhoea / Dysentery", "Malaria", "Anaemia", "Severe Malnutrition", "No classification"]),
    ("Appetite test", "Coded", ["Pass", "Fail"]),
    ("Treatment given (medicine)", "Text", None),
    ("Malaria treatment timing", "Coded", ["Treated within 24 hrs of onset", "Treated after 24 hrs of onset"]),
    ("Counsel mother on feeding", "Coded", YN),
    ("Counsel mother on when to return", "Coded", YN),
    ("Referred to health facility", "Text", None),
    ("Pre-referral treatment given", "Coded", YN),
    ("Follow up date", "Date", None),
    ("Outcome", "Coded", ["Improved", "The same", "Worse", "Died"]),
    ("Albendazole 400 mg (count)", "Numeric", None),
    ("Amoxicillin 250 mg (count)", "Numeric", None),
    ("ACT paediatric (2-11 months) (count)", "Numeric", None),
    ("ACT (1-5 years) (count)", "Numeric", None),
    ("ORS sachets (count)", "Numeric", None),
    ("Paracetamol 100 mg (count)", "Numeric", None),
    ("Zinc 20 mg (count)", "Numeric", None),
    ("Rectal artesunate suppositories (count)", "Numeric", None),
    ("Artesunate 60 mg/ml injection (count)", "Numeric", None),
    ("Oxygen therapy", "Coded", YN),
    ("Other drug (specify)", "Text", None),
    ("Remarks", "Text", None),
]

MODEL = {
    "register": "UNDER FIVE REGISTER FOR PHUs: AGE 2 MONTH-5 YEARS",
    "source": "Sierra Leone IMCI Child Health Register (Google Sheet 16weLQ8mLfLGbEnXNnbTwuV525s9yFNIL)",
    "encounter_type": {
        "name": "Under Five Register",
        "description": "IMCI under-five child visit (2 months - 5 years), Sierra Leone Register.",
    },
    "form": {
        "name": "Under Five (General) Register",
        "version": "1.0",
        "encounterType": "Under Five Register",
    },
    "concepts": {
        "reused": REUSED_CONCEPTS,
        "answers": NEW_ANSWERS,
        "questions": [{"name": n, "datatype": d, "answers": a} for (n, d, a) in QUESTIONS],
    },
}


def obs(**kw):
    return kw


COMMON = {
    # register-level (repeated per encounter as it appears on each register row
    "District": "Bo",
    "Facility Name": "Gbenikoro MCHP",
    "Facility Type": "MCHP",
    "Chiefdom / Zone": "Kakua",
    "Register Year": 2026,
    "Register Month": "August",
    "Service point (in facility / outreach)": "In Facility",
}

PATIENTS = [
    {"given_name": "Fatmata", "family_name": "Sesay", "gender": "F", "birthdate": "2025-01-10", "village": "Njagboima", "chiefdom": "Kakua"},
    {"given_name": "Ibrahim", "family_name": "Koroma", "gender": "M", "birthdate": "2025-11-05", "village": "Tikonko", "chiefdom": "Kakua"},
    {"given_name": "Aminata", "family_name": "Kamara", "gender": "F", "birthdate": "2024-06-20", "village": "Baoma", "chiefdom": "Kakua"},
    {"given_name": "Mohamed", "family_name": "Bangura", "gender": "M", "birthdate": "2025-04-15", "village": "Semabu", "chiefdom": "Kakua"},
    {"given_name": "Hawa", "family_name": "Turay", "gender": "F", "birthdate": "2025-08-30", "village": "Kpange", "chiefdom": "Kakua"},
    {"given_name": "Sorie", "family_name": "Conteh", "gender": "M", "birthdate": "2023-01-05", "village": "Gerihun", "chiefdom": "Kakua"},
]

ENCOUNTERS = [
    {
        "patient": 0,
        "datestamp": "2026-08-20",
        "time": "09:30:00",
        "description": "New visit - malaria treated within 24h of onset",
        "obs": obs(
            **COMMON,
            **{
                "Age in months": 20, "Sex (M/F)": "Female", "Chiefdom / Village": "Kakua / Njagboima",
                "Screened for disability": "No", "Disability present": "N/A",
                "Temperature (C)": 39.2, "Weight (kg)": 10.5, "Height / Length (cm)": 82,
                "MUAC (cm)": 14.5, "WHZ score": 0.1, "WAZ score": -0.3,
                "Presenting complaint": "Fever for 2 days, not eating well",
                "Continued breastfeeding (child 6-23 months)": "No",
                "Type of visit (new / follow-up)": "New",
                "Unable to drink or breastfeed": "No", "Vomiting everything": "No",
                "History of convulsion": "No", "Convulsing now": "No", "Lethargic or unconscious": "No",
                "Oxygen saturation (%)": 99, "Skin pinch": "Normal",
                "Cough or difficult breathing": "No", "Diarrhoea": "No", "Fever": "Yes",
                "Measles in last 3 months": "No", "Generalized rash of measles": "No",
                "Cough / runny nose / red eyes": "No", "Mouth ulcer / pus draining eyes / corneal clouding": "No",
                "Palmar pallor": "No pallor", "Ear problem": "No", "Visible severe wasting": "No",
                "Pitting oedema of both feet": "No", "MUAC category": ">= 12.5 cm", "WHZ category": ">= -2",
                "HIV RDT result": "Not Done", "HIV microscopy result": "Not Done",
                "Immunisation up to date": "Up to date", "Immunisation age band": ">= 6 months",
                "Albendazole status": "Completed",
                "Vitamin A dose band": "12-23 months", "Vitamin A received within last 6 months": "Yes",
                "Albendazole received within last 6 months": "Yes",
                "Other problems": "None",
                "Disease classification": "Malaria", "Appetite test": "Pass",
                "Treatment given (medicine)": "ACT paediatric (AL-6) x1 blister",
                "Malaria treatment timing": "Treated within 24 hrs of onset",
                "Counsel mother on feeding": "Yes", "Counsel mother on when to return": "Yes",
                "Referred to health facility": "", "Pre-referral treatment given": "No",
                "Follow up date": "2026-08-23",
                "Outcome": "Improved",
                "ACT paediatric (2-11 months) (count)": 1, "Paracetamol 100 mg (count)": 4,
                "Remarks": "Fever settled day 2",
            },
        ),
    },
    {
        "patient": 1,
        "datestamp": "2026-08-22",
        "time": "10:15:00",
        "description": "New visit - pneumonia with chest indrawing",
        "obs": obs(
            **COMMON,
            **{
                "Age in months": 9, "Sex (M/F)": "Male", "Chiefdom / Village": "Kakua / Tikonko",
                "Screened for disability": "No", "Disability present": "N/A",
                "Temperature (C)": 38.6, "Weight (kg)": 8.2, "Height / Length (cm)": 71,
                "MUAC (cm)": 13.8, "WHZ score": -0.8, "WAZ score": -0.5,
                "Presenting complaint": "Cough 3 days, fast breathing, no appetite",
                "Exclusive breastfeeding (child < 6 months)": "N/A",
                "Continued breastfeeding (child 6-23 months)": "Yes",
                "Type of visit (new / follow-up)": "New",
                "Unable to drink or breastfeed": "No", "Vomiting everything": "No",
                "History of convulsion": "No", "Convulsing now": "No", "Lethargic or unconscious": "No",
                "Oxygen saturation (%)": 96, "Skin pinch": "Normal",
                "Cough or difficult breathing": "Yes", "Duration of cough (days)": 3,
                "Respiratory rate (per minute)": 52, "Chest indrawing": "Yes", "Stridor present": "No",
                "Diarrhoea": "No", "Fever": "Yes", "Cough / runny nose / red eyes": "Yes",
                "Palmar pallor": "No pallor", "Ear problem": "No",
                "Visible severe wasting": "No", "Pitting oedema of both feet": "No",
                "MUAC category": ">= 12.5 cm", "WHZ category": ">= -2",
                "HIV RDT result": "Not Done", "HIV microscopy result": "Not Done",
                "Immunisation up to date": "Up to date", "Immunisation age band": ">= 6 months",
                "Albendazole status": "Completed",
                "Vitamin A dose band": "6-11 months", "Vitamin A received within last 6 months": "Yes",
                "Albendazole received within last 6 months": "No",
                "Other problems": "None",
                "Disease classification": "Pneumonia / Fever", "Appetite test": "Fail",
                "Treatment given (medicine)": "Amoxicillin 250mg x10",
                "Counsel mother on feeding": "Yes", "Counsel mother on when to return": "Yes",
                "Referred to health facility": "", "Pre-referral treatment given": "No",
                "Follow up date": "2026-08-25",
                "Outcome": "The same",
                "Amoxicillin 250 mg (count)": 1, "Paracetamol 100 mg (count)": 4,
                "Remarks": "Re-check in 2 days",
            },
        ),
    },
    {
        "patient": 2,
        "datestamp": "2026-08-24",
        "time": "11:00:00",
        "description": "New visit - diarrhoea with some dehydration",
        "obs": obs(
            **COMMON,
            **{
                "Age in months": 26, "Sex (M/F)": "Female", "Chiefdom / Village": "Kakua / Baoma",
                "Screened for disability": "No", "Disability present": "N/A",
                "Temperature (C)": 37.4, "Weight (kg)": 12.0, "Height / Length (cm)": 88,
                "MUAC (cm)": 15.0, "WHZ score": 0.4, "WAZ score": -0.1,
                "Presenting complaint": "Watery stools 2 days",
                "Continued breastfeeding (child 6-23 months)": "N/A",
                "Type of visit (new / follow-up)": "New",
                "Unable to drink or breastfeed": "Yes", "Vomiting everything": "No",
                "History of convulsion": "No", "Convulsing now": "No", "Lethargic or unconscious": "No",
                "Oxygen saturation (%)": 98, "Skin pinch": "Slowly",
                "Cough or difficult breathing": "No",
                "Diarrhoea": "Yes", "Duration of diarrhoea (days)": 2, "Blood in stool": "No",
                "Sunken eyes": "Yes", "Weak to drink": "Yes", "Eager / thirsty drinking": "Yes",
                "Skin pinch goes back slowly": "Yes",
                "Fever": "No", "Ear problem": "No",
                "Visible severe wasting": "No", "Pitting oedema of both feet": "No",
                "MUAC category": ">= 12.5 cm", "WHZ category": ">= -2",
                "HIV RDT result": "Not Done", "HIV microscopy result": "Not Done",
                "Immunisation up to date": "Up to date", "Immunisation age band": ">= 6 months",
                "Albendazole status": "Completed",
                "Vitamin A dose band": "24-59 months", "Vitamin A received within last 6 months": "Yes",
                "Albendazole received within last 6 months": "Yes",
                "Other problems": "None",
                "Disease classification": "Watery diarrhoea / Dysentery", "Appetite test": "Pass",
                "Treatment given (medicine)": "ORS + zinc 10 days",
                "Counsel mother on feeding": "Yes", "Counsel mother on when to return": "Yes",
                "Referred to health facility": "", "Pre-referral treatment given": "No",
                "Follow up date": "2026-08-26",
                "Outcome": "Improved",
                "ORS sachets (count)": 2, "Zinc 20 mg (count)": 10,
                "Remarks": "Educated mother on ORS preparation",
            },
        ),
    },
    {
        "patient": 3,
        "datestamp": "2026-08-26",
        "time": "12:45:00",
        "description": "New visit - severe acute malnutrition, referred",
        "obs": obs(
            **COMMON,
            **{
                "Age in months": 16, "Sex (M/F)": "Male", "Chiefdom / Village": "Kakua / Semabu",
                "Screened for disability": "No", "Disability present": "N/A",
                "Temperature (C)": 36.8, "Weight (kg)": 7.0, "Height / Length (cm)": 74,
                "MUAC (cm)": 11.0, "WHZ score": -3.2, "WAZ score": -3.0,
                "Presenting complaint": "Severe wasting, not feeding well",
                "Exclusive breastfeeding (child < 6 months)": "N/A",
                "Continued breastfeeding (child 6-23 months)": "Yes",
                "Type of visit (new / follow-up)": "New",
                "Unable to drink or breastfeed": "No", "Vomiting everything": "No",
                "History of convulsion": "No", "Convulsing now": "No", "Lethargic or unconscious": "Yes",
                "Oxygen saturation (%)": 90, "Skin pinch": "Normal",
                "Cough or difficult breathing": "Yes", "Duration of cough (days)": 5,
                "Respiratory rate (per minute)": 40, "Chest indrawing": "No", "Stridor present": "No",
                "Diarrhoea": "No", "Fever": "Yes", "Palmar pallor": "Severe palmar pallor",
                "Ear problem": "No",
                "Visible severe wasting": "Yes", "Pitting oedema of both feet": "Yes",
                "MUAC category": "< 11.5 cm", "WHZ category": "< -3",
                "HIV RDT result": "Not Done", "HIV microscopy result": "Not Done",
                "Immunisation up to date": "Not up to date", "Immunisation age band": ">= 6 months",
                "Albendazole status": "Unknown",
                "Vitamin A dose band": "12-23 months", "Vitamin A received within last 6 months": "No",
                "Albendazole received within last 6 months": "No",
                "Other problems": "None",
                "Disease classification": "Severe Malnutrition", "Appetite test": "Fail",
                "Treatment given (medicine)": "Referral + oxygen",
                "Counsel mother on feeding": "Yes", "Counsel mother on when to return": "Yes",
                "Referred to health facility": "Bo District Hospital",
                "Pre-referral treatment given": "Yes",
                "Follow up date": "2026-08-28",
                "Outcome": "The same",
                "Oxygen therapy": "Yes",
                "Remarks": "Escorted by health worker",
            },
        ),
    },
    {
        "patient": 4,
        "datestamp": "2026-08-28",
        "time": "08:50:00",
        "description": "New visit - well child, routine check + EPI reminder",
        "obs": obs(
            **COMMON,
            **{
                "Age in months": 12, "Sex (M/F)": "Female", "Chiefdom / Village": "Kakua / Kpange",
                "Screened for disability": "No", "Disability present": "N/A",
                "Temperature (C)": 36.9, "Weight (kg)": 9.5, "Height / Length (cm)": 75,
                "MUAC (cm)": 14.2, "WHZ score": 0.2, "WAZ score": 0.0,
                "Presenting complaint": "Routine well-child check",
                "Exclusive breastfeeding (child < 6 months)": "N/A",
                "Continued breastfeeding (child 6-23 months)": "No",
                "Type of visit (new / follow-up)": "New",
                "Unable to drink or breastfeed": "No", "Vomiting everything": "No",
                "History of convulsion": "No", "Convulsing now": "No", "Lethargic or unconscious": "No",
                "Oxygen saturation (%)": 99, "Skin pinch": "Normal",
                "Cough or difficult breathing": "No", "Diarrhoea": "No", "Fever": "No",
                "Ear problem": "No", "Visible severe wasting": "No",
                "Pitting oedema of both feet": "No", "MUAC category": ">= 12.5 cm",
                "WHZ category": ">= -2",
                "HIV RDT result": "Not Done", "HIV microscopy result": "Not Done",
                "Immunisation up to date": "Up to date", "Immunisation age band": ">= 6 months",
                "Albendazole status": "Completed",
                "Vitamin A dose band": "12-23 months", "Vitamin A received within last 6 months": "Yes",
                "Albendazole received within last 6 months": "Yes",
                "Other problems": "None",
                "Disease classification": "No classification", "Appetite test": "Pass",
                "Counsel mother on feeding": "Yes", "Counsel mother on when to return": "Yes",
                "Referred to health facility": "", "Pre-referral treatment given": "No",
                "Follow up date": "2026-08-30",
                "Outcome": "Improved",
                "Remarks": "EPI/immunisation up to date",
            },
        ),
    },
    {
        "patient": 5,
        "datestamp": "2026-08-30",
        "time": "14:20:00",
        "description": "New visit - malaria treated after 24h of onset (RDT positive)",
        "obs": obs(
            **COMMON,
            **{
                "Age in months": 43, "Sex (M/F)": "Male", "Chiefdom / Village": "Kakua / Gerihun",
                "Screened for disability": "Yes", "Disability present": "No",
                "Temperature (C)": 40.1, "Weight (kg)": 15.0, "Height / Length (cm)": 98,
                "MUAC (cm)": 15.5, "WHZ score": 0.3, "WAZ score": -0.2,
                "Presenting complaint": "High fever 3 days, body aches",
                "Continued breastfeeding (child 6-23 months)": "N/A",
                "Type of visit (new / follow-up)": "New",
                "Unable to drink or breastfeed": "No", "Vomiting everything": "Yes",
                "History of convulsion": "No", "Convulsing now": "No", "Lethargic or unconscious": "No",
                "Oxygen saturation (%)": 97, "Skin pinch": "Normal",
                "Cough or difficult breathing": "No", "Diarrhoea": "No", "Fever": "Yes",
                "Measles in last 3 months": "No", "Generalized rash of measles": "No",
                "Cough / runny nose / red eyes": "No", "Palmar pallor": "Palmar pallor",
                "Ear problem": "No", "Visible severe wasting": "No",
                "Pitting oedema of both feet": "No", "MUAC category": ">= 12.5 cm",
                "WHZ category": ">= -2",
                "HIV RDT result": "Positive", "HIV microscopy result": "Not Done",
                "Immunisation up to date": "Up to date", "Immunisation age band": ">= 6 months",
                "Albendazole status": "Completed",
                "Vitamin A dose band": "24-59 months", "Vitamin A received within last 6 months": "Yes",
                "Albendazole received within last 6 months": "Yes",
                "Other problems": "None",
                "Disease classification": "Malaria", "Appetite test": "Pass",
                "Treatment given (medicine)": "ACT (AL-12) x1 blister",
                "Malaria treatment timing": "Treated after 24 hrs of onset",
                "Counsel mother on feeding": "Yes", "Counsel mother on when to return": "Yes",
                "Referred to health facility": "", "Pre-referral treatment given": "No",
                "Follow up date": "2026-09-02",
                "Outcome": "Worse",
                "ACT (1-5 years) (count)": 1,
                "Remarks": "Mother advised to return immediately if vomiting persists",
            },
        ),
    },
]

MOCK_DATA = {
    "patients": PATIENTS,
    "encounters": ENCOUNTERS,
}


def note_unique(o):
    seen = {}
    for k, v in o.items():
        if v in seen:
            raise SystemExit(f"DUPLICATE: {v!r} used by both {seen[v]!r} and {k!r}")
        seen[v] = k


def note_unique_values(qs):
    seen = {}
    for i, (n, d, a) in enumerate(qs):
        if n in seen:
            raise SystemExit(f"DUPLICATE question {n!r}")
        seen[n] = i


if __name__ == "__main__":
    note_unique(MODEL["concepts"]["reused"])
    note_unique_values(QUESTIONS)
    # fresh answers must not clash with reused or with question names
    fresh = set(MODEL["concepts"]["answers"])
    clash = fresh & set(MODEL["concepts"]["reused"])
    if clash:
        raise SystemExit(f"answer clashes with reused: {clash}")
    ans_names = set(MODEL["concepts"]["answers"]) | set(MODEL["concepts"]["reused"])
    for n, d, a in QUESTIONS:
        if a is not None:
            bad = set(a) - ans_names
            if bad:
                raise SystemExit(f"{n}: unknown answers {bad}")
    with open(os.path.join(OUT_DIR, "under-five-register-model.json"), "w") as f:
        json.dump(MODEL, f, indent=2, ensure_ascii=False)
    for e in MOCK_DATA["encounters"]:
        pass  # add per-scenario metadata below
    with open(os.path.join(OUT_DIR, "under-five-register-mock-data.json"), "w") as f:
        json.dump(MOCK_DATA, f, indent=2, ensure_ascii=False)
    print("OK wrote model + mock data")