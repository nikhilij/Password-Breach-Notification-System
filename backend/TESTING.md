# Password Breach Notification System Test Suite

This document provides instructions for running the comprehensive test suite for the Password Breach Notification System.

## Test Structure

The system has various test types:

1. **Unit Tests**: Test individual components in isolation
2. **Integration Tests**: Test interactions between components
3. **API Tests**: Test the full API endpoints
4. **End-to-End Tests**: Test full user journeys
5. **Performance Tests**: Test system under load

## Running Tests

### Prerequisites

Make sure you have installed all dependencies:

```bash
npm install
```

### Running All Tests

To run the complete test suite:

```bash
npm run test:all
```

### Running Specific Test Types

#### Unit Tests

```bash
npm run test:unit
```

#### Integration Tests

```bash
npm run test:integration
```

#### E2E Tests

```bash
npm run test:e2e
```

#### API Tests

Note: This requires the API server to be running.

```bash
npm run test:api
```

#### Performance Tests

```bash
npm run test:performance
```

### Test Reports

Test reports are generated in the `reports/` directory:

- `reports/unit/`: Unit test reports
- `reports/integration/`: Integration test reports
- `reports/api/`: API test reports
- `reports/e2e/`: End-to-End test reports
- `reports/performance/`: Performance test reports

## Troubleshooting

### Common Issues

1. **Database Connection Issues**: Make sure MongoDB is running or the MongoMemoryServer is functioning correctly.

2. **Missing Dependencies**: Ensure all packages are installed (`npm install`).

3. **API Server Not Running**: For API tests, ensure the server is running (`npm run dev`).

4. **Test Discovery Issues**: Check the file naming conventions. Tests should be named `*.test.js`.

5. **Timeout Issues**: Some tests may time out. Try increasing the timeout in `jest.config.json`.

## Adding New Tests

When adding new tests:

1. Follow the established patterns for each test type.
2. Add the test in the appropriate directory:
   - Unit tests: `tests/unit/`
   - Integration tests: `tests/integration/`
   - E2E tests: `tests/e2e/`
   - Performance tests: `tests/performance/`
3. Make sure to update any mocks as needed.
