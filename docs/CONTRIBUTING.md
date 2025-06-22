# Contributing to Text2IaC

Thank you for your interest in contributing to Text2IaC! We welcome contributions from the community to help improve this project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Pull Request Process](#pull-request-process)
- [Reporting Issues](#reporting-issues)
- [Feature Requests](#feature-requests)
- [Documentation](#documentation)
- [Testing](#testing)
- [License](#license)

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it before making any contributions.

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally
   ```bash
   git clone https://github.com/devopsterminal/text2iac.git
   cd text2iac
   ```
3. **Set up** the development environment
   ```bash
   make install
   ```
4. **Run** the development server
   ```bash
   make dev
   ```

## Development Workflow

1. Create a new branch for your feature or bugfix:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-number-description
   ```

2. Make your changes following the code style guidelines

3. Run tests and linters:
   ```bash
   make test
   make lint
   ```

4. Commit your changes with a descriptive message:
   ```bash
   git commit -m "feat: add new feature"
   # or
   git commit -m "fix: resolve issue with login"
   ```

5. Push to your fork:
   ```bash
   git push origin your-branch-name
   ```

6. Open a **Pull Request** against the `main` branch

## Code Style

### TypeScript/JavaScript
- Use TypeScript for all new code
- Follow [TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)
- Use ESLint and Prettier for code formatting
- Run `make format` before committing

### Python
- Follow [PEP 8](https://www.python.org/dev/peps/pep-0008/)
- Use type hints for all function parameters and return values
- Use Black for code formatting

### Git Commit Messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to the build process or auxiliary tools

## Pull Request Process

1. Ensure any install or build dependencies are removed before the end of the layer when doing a build.
2. Update the README.md with details of changes to the interface, including new environment variables, exposed ports, useful file locations, and container parameters.
3. Increase the version numbers in any examples files and the README.md to the new version that this Pull Request would represent. The versioning scheme we use is [SemVer](http://semver.org/).
4. You may merge the Pull Request in once you have the sign-off of two other developers, or if you do not have permission to do that, you may request the second reviewer to merge it for you.

## Reporting Issues

When creating an issue, please include:

1. A clear, descriptive title
2. Steps to reproduce the issue
3. Expected vs. actual behavior
4. Screenshots if applicable
5. Environment information (OS, browser, version, etc.)

## Feature Requests

We welcome feature requests! Please:

1. Check if a similar feature already exists
2. Explain why this feature would be valuable
3. Include any relevant use cases or examples

## Documentation

Good documentation is crucial for the success of any open-source project. We encourage you to:

1. Keep documentation up-to-date with your changes
2. Add comments to explain complex logic
3. Update README files when adding new features

## Testing

- Write tests for new features and bug fixes
- Ensure all tests pass before submitting a PR
- Follow the testing guidelines in each package's README

## License

By contributing to this project, you agree that your contributions will be licensed under its [ApacheLicense](LICENSE).

## Thank You!

Your contributions to open source, large or small, make great projects like this possible. Thank you for being part of our community!
