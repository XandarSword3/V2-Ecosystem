# V2 Resort Documentation

Welcome to the V2 Resort documentation. This directory contains operational documentation, guides, and reference materials for the V2 Resort Management System.

## Documentation Index

### Operational Guides

| Document | Description |
|----------|-------------|
| [DISASTER_RECOVERY.md](DISASTER_RECOVERY.md) | Database backup & recovery procedures |
| [HANDOFF_DOCUMENTATION.md](HANDOFF_DOCUMENTATION.md) | System handoff guide for new developers |
| [ON_CALL_PLAYBOOK.md](ON_CALL_PLAYBOOK.md) | Incident response procedures |
| [STAFF_TRAINING.md](STAFF_TRAINING.md) | Staff training materials |

### Feature Documentation

| Document | Description |
|----------|-------------|
| [NEW_FEATURES_USER_MANUAL.md](NEW_FEATURES_USER_MANUAL.md) | Guide to recently added features |
| [USER_GUIDE_COMPLETE.md](USER_GUIDE_COMPLETE.md) | Complete user guide |
| [MOBILE_APP_INFRASTRUCTURE.md](MOBILE_APP_INFRASTRUCTURE.md) | Mobile app architecture |

### Architecture & Technical Docs

For technical documentation, see the README files in each subsystem:

| Subsystem | Location | Description |
|-----------|----------|-------------|
| Backend | [../backend/README.md](../backend/README.md) | Express.js API server |
| Frontend | [../frontend/README.md](../frontend/README.md) | Next.js web application |
| Shared Types | [../shared/README.md](../shared/README.md) | Shared TypeScript types |
| Database | [../backend/src/database/README.md](../backend/src/database/README.md) | Database layer |
| API Reference | [../backend/docs/API_ENDPOINTS.md](../backend/docs/API_ENDPOINTS.md) | Complete API documentation |

### Archived Documentation

Historical documentation from the development process is preserved in the [_archive](./_archive/) directory:

- **Audit Reports**: Security audits, codebase reviews, verification reports
- **Completion Reports**: Sprint completion and implementation summaries
- **Progress Tracking**: Development progress, blockers, and roadmaps
- **Strategic Analysis**: Market research and feature planning

See [_archive/README.md](./_archive/README.md) for the archive index.

---

## Quick Links

### For Developers

1. **Getting Started**: [../DEVELOPMENT_SETUP.md](../DEVELOPMENT_SETUP.md)
2. **Architecture Overview**: [../ARCHITECTURE.md](../ARCHITECTURE.md)
3. **Testing Guide**: [../TESTING.md](../TESTING.md)
4. **API Documentation**: [../API.md](../API.md)

### For System Administrators

1. **Deployment**: [../backend/docs/DEPLOYMENT_GUIDE.md](../backend/docs/DEPLOYMENT_GUIDE.md)
2. **Disaster Recovery**: [DISASTER_RECOVERY.md](DISASTER_RECOVERY.md)
3. **On-Call Playbook**: [ON_CALL_PLAYBOOK.md](ON_CALL_PLAYBOOK.md)

### For End Users

1. **User Guide**: [USER_GUIDE_COMPLETE.md](USER_GUIDE_COMPLETE.md)
2. **Feature Manual**: [NEW_FEATURES_USER_MANUAL.md](NEW_FEATURES_USER_MANUAL.md)

---

## Documentation Standards

When creating new documentation:

1. **Use Markdown**: All documentation should be in Markdown format
2. **Be Specific**: Include code examples, screenshots, and concrete steps
3. **Stay Current**: Update documentation when features change
4. **Link Related Docs**: Cross-reference related documentation
5. **Archive Old Docs**: Move outdated documentation to `_archive/`
