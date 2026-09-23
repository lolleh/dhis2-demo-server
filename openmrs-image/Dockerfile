# Custom-branded OpenMRS PIH EMR image for the Sierra Leone demo stack.
#
# Reproduces the design that used to be baked manually into the local
# `dhis2-demo-openmrs:moh-*` images by layering this repo's tracked
# customizations on top of the stock partnersinhealth/pihsl-emr image:
#
#   * content/configuration/backend_configuration/  ->  /openmrs/distribution/openmrs_config/
#     (MOH branding, sl.css theme, htmlforms, check-in/registration flows,
#      the above-five reports, register extensions, extra site profiles)
#   * openmrs-image/spa/                             ->  /openmrs/distribution/openmrs_spa/
#     (O3 SPA login page branding, Ministry of Health logo + config)
#   * openmrs-image/openmrs-distro.properties        ->  /openmrs/distribution/
#     (default pih.config = sierraLeone,sierraLeone-mongo, as the custom
#      images shipped; still overridable via OMRS_EXTRA_pih_config)
#   * openmrs-image/pihcore-2.2.0-SNAPSHOT.omod      ->  /openmrs/distribution/openmrs_modules/
#     (pihcore built with the SL registration id labels:
#      "Voters ID" / "Driver's License" instead of the stock wellbody/kgh EMR IDs)
#
# A handful of stock data-export report descriptors are removed to match the
# custom image (those reports were replaced by the above-five register reports).
#
# Build is wired into docker-compose.yml (openmrs service) so a fresh checkout
# reproduces the branded UI via:  docker compose up -d --build openmrs
FROM partnersinhealth/pihsl-emr:latest

# 1. overlay the tracked Sierra Leone backend configuration
COPY content/configuration/backend_configuration/ /openmrs/distribution/openmrs_config/

# 2. remove stock data-export reports that are replaced by the custom ones
RUN rm -f \
    /openmrs/distribution/openmrs_config/reports/reportdescriptors/dataexports/allergies.yml \
    /openmrs/distribution/openmrs_config/reports/reportdescriptors/dataexports/eveningMaternalHandoff.yml \
    /openmrs/distribution/openmrs_config/reports/reportdescriptors/dataexports/hospitalizations.yml \
    /openmrs/distribution/openmrs_config/reports/reportdescriptors/dataexports/mentalHealth.yml \
    /openmrs/distribution/openmrs_config/reports/reportdescriptors/dataexports/mentalHealthCaseRegistration.yml \
    /openmrs/distribution/openmrs_config/reports/reportdescriptors/dataexports/mentalHealthProgram.yml \
    /openmrs/distribution/openmrs_config/reports/reportdescriptors/dataexports/morningMaternalHandoff.yml \
    /openmrs/distribution/openmrs_config/reports/reportdescriptors/dataexports/ncd.yml \
    /openmrs/distribution/openmrs_config/reports/reportdescriptors/dataexports/ncdEncounter.yml \
    /openmrs/distribution/openmrs_config/reports/reportdescriptors/dataexports/ncdPatient.yml \
    /openmrs/distribution/openmrs_config/reports/reportdescriptors/dataexports/ncdProgram.yml \
    /openmrs/distribution/openmrs_config/reports/reportdescriptors/dataexports/nicuDischargeList.yml \
    /openmrs/distribution/openmrs_config/reports/reportdescriptors/dataexports/surgery.yml \
    /openmrs/distribution/openmrs_config/reports/reportdescriptors/dataexports/triage.yml \
    /openmrs/distribution/openmrs_config/reports/reportdescriptors/dataexports/vitals.yml

# 3. O3 SPA branding (login page, MOH logo + app config)
COPY openmrs-image/spa/ /openmrs/distribution/openmrs_spa/

# 4. default distro config
COPY openmrs-image/openmrs-distro.properties /openmrs/distribution/openmrs-distro.properties

# 5. pihcore rebuilt with the SL registration id labels
COPY openmrs-image/pihcore-2.2.0-SNAPSHOT.omod /openmrs/distribution/openmrs_modules/pihcore-2.2.0-SNAPSHOT.omod