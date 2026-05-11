# Contributing to OSS-2026

First off, thank you for considering contributing to OSS-2026! It's people like you that make planetary exploration software accessible to the global scientific community.

## 🚀 Mission Objectives

We welcome contributions in the following areas:
- **Navigation Algorithms**: Enhancements to the A* implementation or new swarm heuristics.
- **Terrain Analysis**: Better hazard detection logic or integration of new Mars datasets (e.g., CRISM, SHARAD).
- **Dashboard UI**: Improving the real-time visualization and telemetry monitoring.
- **Documentation**: Fixing typos or explaining scientific concepts.

## 📋 How to Contribute

### 1. Report Bugs
If you find a bug, please open an issue. Include:
- A clear, descriptive title.
- Steps to reproduce.
- Expected vs. actual behavior.
- Mission logs or telemetry snapshots.

### 2. Suggest Enhancements
Feature requests are welcome! Please explain the scientific or operational value of the proposed change.

### 3. Pull Requests
1. **Fork the Repo**: Create your own copy of the mission parameters.
2. **Setup Environment**: Follow the instructions in [README.md](./README.md).
3. **Format & Lint**: We use Prettier for JS/TS and Black for Python. Ensure your code passes `npm run lint`.
4. **Commit Messages**: Use clear, imperative titles (e.g., `feat: add slope-aware energy cost to A* search`).
5. **Submit**: Link your PR to the relevant issue.

## 🧪 Development Workflow

### Scientific Engine (Python/FastAPI)
The routing engine lives in `/routing`. 
- Test changes by running `python routing/main.py` and hitting the `/docs` endpoint for interactive testing.
- Optimization weights should be verified using the `swarm.py` simulation scripts.

### Mission Control (React/Express)
The dashboard lives in `/src` and the server in `server.ts`.
- Ensure all new Firestore interactions follow the error handling patterns in `src/lib/firebase.ts`.
- Update `firestore.rules` if you introduce new data collections.

## ⚖️ License
By contributing, you agree that your contributions will be licensed under the project's MIT License.
