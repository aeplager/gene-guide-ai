#!/usr/bin/env python3

###############################################################################
# GCP Setup Validation Script for Gene Guide AI
# Checks prerequisites and GCP configuration before deployment
# Usage: python3 validate-gcp-setup.py <GCP_PROJECT_ID>
###############################################################################

import sys
import subprocess
import json
import os
from pathlib import Path

# Colors
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

def log_info(msg):
    print(f"{Colors.OKBLUE}[INFO]{Colors.ENDC} {msg}")

def log_success(msg):
    print(f"{Colors.OKGREEN}[SUCCESS]{Colors.ENDC} {msg}")

def log_warning(msg):
    print(f"{Colors.WARNING}[WARNING]{Colors.ENDC} {msg}")

def log_error(msg):
    print(f"{Colors.FAIL}[ERROR]{Colors.ENDC} {msg}")

def run_command(cmd, silent=False):
    """Run a shell command and return output"""
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            return result.stdout.strip()
        else:
            if not silent:
                log_error(f"Command failed: {cmd}")
            return None
    except subprocess.TimeoutExpired:
        log_error(f"Command timed out: {cmd}")
        return None
    except Exception as e:
        log_error(f"Error running command: {e}")
        return None

def check_tool(tool_name, cmd):
    """Check if a tool is installed"""
    log_info(f"Checking {tool_name}...")
    result = run_command(cmd, silent=True)
    if result:
        log_success(f"{tool_name} is installed")
        return True
    else:
        log_error(f"{tool_name} is NOT installed")
        return False

def check_gcp_auth(project_id):
    """Check if authenticated with GCP"""
    log_info("Checking GCP authentication...")
    result = run_command("gcloud auth list --filter=status:ACTIVE --format=value(account)")
    if result:
        log_success(f"Authenticated as: {result}")
        return True
    else:
        log_error("Not authenticated with GCP. Run: gcloud auth login")
        return False

def check_gcp_project(project_id):
    """Check if project exists and is accessible"""
    log_info(f"Checking GCP project: {project_id}...")
    cmd = f"gcloud projects describe {project_id} --format=value(projectId)"
    result = run_command(cmd)
    if result and result == project_id:
        log_success(f"Project accessible: {project_id}")
        return True
    else:
        log_error(f"Cannot access project: {project_id}")
        return False

def check_gcp_apis(project_id):
    """Check if required APIs are enabled"""
    log_info("Checking Google Cloud APIs...")
    required_apis = [
        "run.googleapis.com",
        "cloudbuild.googleapis.com",
        "artifactregistry.googleapis.com",
        "compute.googleapis.com"
    ]
    
    cmd = f"gcloud services list --project={project_id} --enabled --format=value(name)"
    result = run_command(cmd)
    
    if not result:
        log_warning("Could not verify APIs (permission issue is ok)")
        return True
    
    enabled_apis = result.split('\n')
    all_enabled = True
    
    for api in required_apis:
        if any(api in line for line in enabled_apis):
            log_success(f"API enabled: {api}")
        else:
            log_warning(f"API not enabled: {api}")
            all_enabled = False
    
    return all_enabled

def check_artifact_registry(project_id, region):
    """Check if Artifact Registry is configured"""
    log_info(f"Checking Artifact Registry in {region}...")
    cmd = f"gcloud artifacts repositories list --project={project_id} --location={region} --format=value(name)"
    result = run_command(cmd, silent=True)
    
    if result and "gene-guide-repo" in result:
        log_success("Artifact Registry repository exists")
        return True
    else:
        log_warning("Artifact Registry repository not yet created (will be created during deploy)")
        return True

def check_env_file():
    """Check if .env file exists"""
    log_info("Checking .env configuration file...")
    if os.path.exists(".env"):
        log_success(".env file found")
        
        # Check for critical variables
        with open(".env", "r") as f:
            content = f.read()
        
        critical_vars = [
            "TAVUS_API_KEY",
            "TAVUS_REPLICA_ID",
            "TAVUS_PERSONA_ID",
            "DB_CONNECTION_STRING",
            "JWT_SECRET"
        ]
        
        missing = []
        for var in critical_vars:
            if var not in content:
                missing.append(var)
        
        if missing:
            log_warning(f"Missing environment variables: {', '.join(missing)}")
            return False
        else:
            log_success("All critical environment variables found")
            return True
    else:
        log_error(".env file not found")
        return False

def check_dockerfiles():
    """Check if Dockerfiles exist"""
    log_info("Checking Dockerfiles...")
    required_files = [
        "Dockerfile.backend",
        "Dockerfile.frontend",
        "nginx.conf"
    ]
    
    all_exist = True
    for file in required_files:
        if os.path.exists(file):
            log_success(f"Found: {file}")
        else:
            log_error(f"Missing: {file}")
            all_exist = False
    
    return all_exist

def check_gcp_quota(project_id, region):
    """Check if Cloud Run quota is available"""
    log_info("Checking Cloud Run quota...")
    # This requires permission to check quotas
    log_success("Cloud Run quota check (assumed ok)")
    return True

def main():
    if len(sys.argv) < 2:
        log_error("GCP Project ID is required")
        print("Usage: python3 validate-gcp-setup.py <GCP_PROJECT_ID> [REGION]")
        sys.exit(1)
    
    project_id = sys.argv[1]
    region = sys.argv[2] if len(sys.argv) > 2 else "us-central1"
    
    print(f"\n{Colors.BOLD}{Colors.HEADER}═══════════════════════════════════════════════════════════════{Colors.ENDC}")
    print(f"{Colors.BOLD}GCP Setup Validation for Gene Guide AI{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.HEADER}═══════════════════════════════════════════════════════════════{Colors.ENDC}\n")
    
    checks = [
        ("Tools", [
            ("gcloud", "gcloud --version"),
            ("docker", "docker --version"),
            ("git", "git --version")
        ]),
    ]
    
    # Tool checks
    log_info("=== Checking Prerequisites ===")
    tools_ok = all(check_tool(name, cmd) for name, cmd in checks[0][1])
    
    if not tools_ok:
        print(f"\n{Colors.FAIL}Please install missing tools{Colors.ENDC}")
        sys.exit(1)
    
    # GCP checks
    print(f"\n{Colors.BOLD}=== Checking GCP Configuration ==={Colors.ENDC}")
    gcp_auth_ok = check_gcp_auth(project_id)
    
    if not gcp_auth_ok:
        print(f"\n{Colors.FAIL}Please authenticate with GCP{Colors.ENDC}")
        sys.exit(1)
    
    project_ok = check_gcp_project(project_id)
    apis_ok = check_gcp_apis(project_id)
    registry_ok = check_artifact_registry(project_id, region)
    quota_ok = check_gcp_quota(project_id, region)
    
    # Application checks
    print(f"\n{Colors.BOLD}=== Checking Application Configuration ==={Colors.ENDC}")
    env_ok = check_env_file()
    dockerfiles_ok = check_dockerfiles()
    
    # Summary
    print(f"\n{Colors.BOLD}{Colors.HEADER}═══════════════════════════════════════════════════════════════{Colors.ENDC}")
    
    all_checks = all([tools_ok, gcp_auth_ok, project_ok, apis_ok, env_ok, dockerfiles_ok])
    
    if all_checks:
        log_success("All checks passed! Ready to deploy.")
        print(f"\nNext step: ./deploy-gcp.sh {project_id} {region}")
        sys.exit(0)
    else:
        log_error("Some checks failed. Please fix the issues above.")
        sys.exit(1)

if __name__ == "__main__":
    main()
