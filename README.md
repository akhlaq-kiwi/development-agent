# Antigravity Git-Issue Builder Automation

This workspace contains an automated development runner suite built as a collection of modular shell scripts. The runner fetches open GitHub issues (starting with the oldest first), tracks their state by moving markdown files through a `requirements/` directory lifecycle, invokes the Antigravity agent (`agy`) to implement changes, commits and pushes, creates a Pull Request, and runs deployment procedures.

## Directory Structure

```text
├── builder/
│   ├── main_agent.sh    # Core orchestrator script
│   ├── fetch_issues.sh  # Fetches oldest-first open issues from GitHub
│   ├── run_agent.sh     # Invokes the agy CLI on issue content
│   ├── git_manager.sh   # Manages Git branches, PRs, and label removals
│   ├── deploy.sh        # Runs post-implementation builds and deployments
│   ├── .env.example     # Environment variables configuration template
│   ├── .env             # Active environment credentials (created from template)
│   └── README.md        # This documentation file
└── requirements/        # Created in the target codebase (PROJECT_DIR)
    ├── open/            # Markdown requirement files for open issues
    ├── In_progress/     # Issue markdown files currently being processed
    └── done/            # Completed issue markdown files
```

## Prerequisites

Ensure the following tools are installed and available on your system path:
1. **Antigravity CLI** (`agy`): The agent-first development platform command line tool.
2. **Git**: For version control commands.
3. **cURL**: For interacting with the GitHub API.
4. **jq**: A command-line JSON processor (used for parsing API payloads).

## Configuration

The scripts use environment variables for authentication and targeting:

| Environment Variable | Description | Default | Required |
| --- | --- | --- | --- |
| `GITHUB_PAT` | Your GitHub Personal Access Token (requires `repo` scope). | None | **Yes** (Except in Dry-Run) |
| `GITHUB_REPOSITORY` | Repository path formatted as `owner/repo` (e.g. `octocat/hello-world`). | None | **Yes** (Except in Dry-Run) |
| `ISSUE_LABEL` | The issue label to watch for and process. | `antigravity` | No |
| `BASE_BRANCH` | The default development branch. | `main` | No |

## Usage

### 1. Dry Run Verification
You can test the entire pipeline (including directory generation and requirements file transitions) using the dry-run flag. This uses mock issues and does not query GitHub or execute code changes:
```bash
./builder/main_agent.sh --dry-run
```

### 2. Live Execution
You can configure environment variables in a `.env` file within the `builder/` directory:
1. Copy the example configuration template: `cp builder/.env.example builder/.env`
2. Populate the parameters in `builder/.env`.
3. Execute the orchestration script:
```bash
./builder/main_agent.sh
```

## Customization

- **Prompts**: Modify `builder/run_agent.sh` to adjust the instructions given to the agent.
- **Build/Deployment**: Add your custom build/deployment code (e.g., Docker commands, AWS/GCP CLI deployments) to `builder/deploy.sh`.
