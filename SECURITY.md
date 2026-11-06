# Security Policy

## Supported Versions

ElectriMap DPR is currently under active development. Security updates are applied to the active development branch:

| Version | Supported          |
| ------- | ------------------ |
| `main`  | :white_check_mark: |
| < 0.1.0 | :x:                |

---

## Reporting a Vulnerability

We take the security of ElectriMap DPR seriously. If you believe you have discovered a security vulnerability in this project, **please do not report it in a public GitHub issue**.

Instead, please send a responsible disclosure email to:

**swayamkr26@gmail.com**

Please include in your report:
1. A clear description of the vulnerability and its potential impact.
2. Step-by-step instructions or proof-of-concept to reproduce the issue.
3. Affected components (e.g., API endpoint, frontend view, authentication flow, file upload handler).
4. Any proposed remediations or patches if available.

### What to Expect
- **Acknowledgment**: You will receive an acknowledgment of your report within 48 hours.
- **Assessment**: We will assess the severity and impact, verifying the vulnerability locally.
- **Fix & Advisory**: A fix will be developed, tested against our quality gates, and published with an attribution credit (unless you prefer anonymity).

---

## Security Architecture Highlights

ElectriMap DPR implements several security controls by design:
- **Authentication & CSRF**: Session-based cookie authentication with `SameSite=Lax` and explicit double-submit CSRF token validation (`X-CSRF-Token`) on all state-modifying requests (`POST`, `PUT`, `PATCH`, `DELETE`).
- **Path Traversal Protection**: All user-supplied file uploads (GeoJSON, KML, Shapefiles) and raster tile requests are validated through safe path resolution, preventing directory traversal outside the configured storage directory.
- **SQL Injection Prevention**: All spatial and relational database operations use SQLAlchemy 2.0 ORM and parameterized queries.
- **Credential Protection**: User passwords are encrypted using `bcrypt`. No API keys or credentials are committed to version control.
