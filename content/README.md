# PIH Sierra Leone Content Mirror

This directory mirrors the [PIH Sierra Leone EMR](https://github.com/PIH/pihsl-emr) content package
(`content/configuration`) so the OpenMRS service in this demo stack is driven by the same
configuration structure used in production.

## Layout

```
content/
├── configuration/
│   ├── backend_configuration/          # OpenMRS Initializer backend config
│   │   ├── addresshierarchy/           # Sierra Leone address hierarchy (XML + CSV entries)
│   │   ├── appframework/               # Frontend app-framework dashboard extensions (JSON)
│   │   ├── appointmentservicedefinitions/
│   │   ├── appointmentspecialities/
│   │   ├── conceptreferencerange/      # Vitals reference ranges (incl. pregnancy)
│   │   ├── drugs/
│   │   ├── encountertypes/
│   │   ├── globalproperties/           # GP overrides (cause of death, queue, lab, pihsl, ...)
│   │   ├── locations/
│   │   ├── locationtagmaps/
│   │   ├── messageproperties/          # Localized message overrides (Krio etc.)
│   │   ├── patientidentifiertypes/
│   │   ├── pih/                        # PIH-specific: config profiles, HTML forms, subforms,
│   │   │                               #  liquibase, scripts, styles, statusData, logo
│   │   ├── programs/
│   │   ├── programworkflows/
│   │   ├── programworkflowstates/
│   │   ├── queues/
│   │   ├── reports/
│   │   └── roles/
│   └── frontend_configuration/         # O3/SPA frontend branding (config.json, logo.png)
└── content.properties                  # Content package name/version + shared UUID constants
```

## How it is used in this stack

- **Backend metadata**: `backend_configuration/` is mounted into the OpenMRS container at
  `.OpenMRS/configuration` (the OpenMRS app-data configuration folder). The
  [OpenMRS Initializer module](https://github.com/mekomsolutions/openmrs-module-initializer)
  (vendored under `openmrs-forms/initializer/`) processes those domain folders on startup.
  Note: unlike the PIH Maven build, there is no `backend_configuration`/`frontend_configuration`
  merge step here — the initializer expects domain folders directly under `configuration/`, so
  only the `backend_configuration` contents are mounted at that path.
- **Frontend branding**: `frontend_configuration/` is kept in-repo for provenance. The running
  O3 SPA reads its config from `.OpenMRS/frontend/config.json` inside the container (which already
  carries the PIH SL frontend config) and is not overwritten by this directory.
- **Admin columns**: see the OpenMRS Initializer README for the supported domain list and load
  order. Loading tolerates failures (`initializer.startup.load=continue_on_error`) because some
  PIH domains reference concepts/modules only present in the full PIH EMR distro.

## Keeping it in sync

To refresh from upstream:

```bash
rm -rf content/configuration
cp -r /path/to/pihsl-emr/content/configuration content/
cp /path/to/pihsl-emr/content/content.properties content/
```