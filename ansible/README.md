# Ansible Configuration & Deployment Automation

This directory contains Ansible playbooks to automate host preparation, container building, health checks, and stack orchestration.

## 🚀 Running the Playbook

```bash
cd ansible
ansible-playbook -i inventory.ini playbooks/site.yml
```

### What the playbook automates:
1. Validates Docker host prerequisites.
2. Asserts `.env` secret file integrity.
3. Builds and launches the multi-container Docker Compose stack.
4. Performs automated HTTP health probe polling against `/health`.
5. Validates Prometheus `/metrics` availability.
6. Prints the endpoints for Grafana, Prometheus, and the Web Resume.
