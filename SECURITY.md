# Security Policy

## Supported Versions

The following versions of OSS-2026 are currently supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | ✅ Yes              |
| < 1.0   | ❌ No               |

## Reporting a Vulnerability

**Do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability within the OSS-2026 infrastructure (including the Dashboard, Routing Engine, or Firebase Rules), please follow these steps:

1.  **Email Disclosure**: Send a detailed report to `nashetaliaiexpert@gmail.com` with the subject line `[SECURITY VULNERABILITY] OSS-2026`.
2.  **Information Requested**:
    -   A description of the vulnerability.
    -   Steps to reproduce (PoC).
    -   Potential impact on rover telemetry or mission integrity.
3.  **Response Time**: We acknowledge all submissions within 48 hours and aim to provide a resolution within 7 days.

### Encryption

For sensitive reports, please use PGP encryption. (Key ID: `MISSING_IN_PROTO_ADD_MANUALLY`)

## Security Principles

-   **Zero-Trust Telemetry**: Every state update is validated for identity and schema integrity via Firestore rules.
-   **Hardware Isolation**: Scientific engines run in restricted containers with limited syscall access.
-   **Data Immutability**: Historical mission logs are append-only to prevent tampering.
