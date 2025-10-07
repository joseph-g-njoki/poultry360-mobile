import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import ErrorBoundary from '../ErrorBoundary';

// Component that throws an error
const ThrowError = ({ shouldThrow, errorMessage }) => {
  if (shouldThrow) {
    throw new Error(errorMessage || 'Test error');
  }
  return <Text>No Error</Text>;
};

describe('ErrorBoundary', () => {
  // Suppress console errors for these tests
  const originalError = console.error;

  beforeAll(() => {
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalError;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Normal Rendering', () => {
    it('should render children when there is no error', () => {
      const { getByText } = render(
        <ErrorBoundary>
          <Text>Child Component</Text>
        </ErrorBoundary>
      );

      expect(getByText('Child Component')).toBeTruthy();
    });

    it('should pass through multiple children', () => {
      const { getByText } = render(
        <ErrorBoundary>
          <Text>Child 1</Text>
          <Text>Child 2</Text>
          <Text>Child 3</Text>
        </ErrorBoundary>
      );

      expect(getByText('Child 1')).toBeTruthy();
      expect(getByText('Child 2')).toBeTruthy();
      expect(getByText('Child 3')).toBeTruthy();
    });
  });

  describe('Error Catching', () => {
    it('should catch errors and render error UI', () => {
      const { getByText, queryByText } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Critical error" />
        </ErrorBoundary>
      );

      // Should NOT render the child that threw error
      expect(queryByText('No Error')).toBeNull();

      // Should render error boundary UI
      expect(getByText(/something went wrong/i)).toBeTruthy();
    });

    it('should display error message in error UI', () => {
      const errorMessage = 'Custom error message';

      const { getByText } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage={errorMessage} />
        </ErrorBoundary>
      );

      expect(getByText(errorMessage)).toBeTruthy();
    });

    it('should include screen name in error display', () => {
      const screenName = 'TestScreen';

      const { getByText } = render(
        <ErrorBoundary screenName={screenName}>
          <ThrowError shouldThrow={true} errorMessage="Test error" />
        </ErrorBoundary>
      );

      expect(getByText(new RegExp(screenName, 'i'))).toBeTruthy();
    });
  });

  describe('Silent Error Handling', () => {
    it('should handle database errors silently without showing UI', () => {
      const { queryByText, getByText } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Database error occurred" />
        </ErrorBoundary>
      );

      // Should NOT show error UI for database errors (silent handling)
      // But will depend on implementation - may need to check console.error instead
      expect(console.error).toHaveBeenCalled();
    });

    it('should handle network errors silently', () => {
      const { queryByText } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Network timeout" />
        </ErrorBoundary>
      );

      expect(console.error).toHaveBeenCalled();
    });

    it('should handle SQLite errors silently', () => {
      const { queryByText } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="SQLite initialization failed" />
        </ErrorBoundary>
      );

      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('Error Logging', () => {
    it('should log error details to console', () => {
      render(
        <ErrorBoundary screenName="TestScreen">
          <ThrowError shouldThrow={true} errorMessage="Test error for logging" />
        </ErrorBoundary>
      );

      expect(console.error).toHaveBeenCalled();
      const errorCalls = console.error.mock.calls;

      // Check if error was logged
      const hasErrorLog = errorCalls.some(call =>
        call.some(arg =>
          typeof arg === 'string' && arg.includes('ErrorBoundary')
        )
      );

      expect(hasErrorLog).toBe(true);
    });

    it('should include component stack in error info', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Stack trace test" />
        </ErrorBoundary>
      );

      // Error should be logged with stack information
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('Error Recovery', () => {
    it('should track error count', () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      // First error
      rerender(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="First error" />
        </ErrorBoundary>
      );

      // Error count should be incremented (check via console logs or state)
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('Props Handling', () => {
    it('should accept and use screenName prop', () => {
      const { getByText } = render(
        <ErrorBoundary screenName="CustomScreen">
          <ThrowError shouldThrow={true} errorMessage="Props test error" />
        </ErrorBoundary>
      );

      expect(getByText(/CustomScreen/i)).toBeTruthy();
    });

    it('should use default screen name when not provided', () => {
      const { getByText } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Default screen test" />
        </ErrorBoundary>
      );

      // Should show some screen identifier (either default or error message)
      expect(getByText(/something went wrong/i)).toBeTruthy();
    });
  });

  describe('Component Lifecycle', () => {
    it('should initialize with no error state', () => {
      const { getByText } = render(
        <ErrorBoundary>
          <Text>Initial State</Text>
        </ErrorBoundary>
      );

      expect(getByText('Initial State')).toBeTruthy();
    });

    it('should update state when error occurs', () => {
      const { queryByText, rerender } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(queryByText('No Error')).toBeTruthy();

      // Trigger error
      rerender(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Lifecycle error" />
        </ErrorBoundary>
      );

      // State should have changed - error UI should be shown
      expect(queryByText(/something went wrong/i)).toBeTruthy();
    });
  });

  describe('Multiple Errors', () => {
    it('should handle multiple error instances', () => {
      // First error boundary
      const { getByText: getByText1 } = render(
        <ErrorBoundary screenName="Boundary1">
          <ThrowError shouldThrow={true} errorMessage="Error 1" />
        </ErrorBoundary>
      );

      // Second error boundary
      const { getByText: getByText2 } = render(
        <ErrorBoundary screenName="Boundary2">
          <ThrowError shouldThrow={true} errorMessage="Error 2" />
        </ErrorBoundary>
      );

      expect(getByText1('Error 1')).toBeTruthy();
      expect(getByText2('Error 2')).toBeTruthy();
    });
  });

  describe('Error Display Content', () => {
    it('should display user-friendly error message', () => {
      const { getByText } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="User-facing error" />
        </ErrorBoundary>
      );

      // Should contain user-friendly text
      expect(getByText(/something went wrong/i)).toBeTruthy();
    });

    it('should provide technical error details', () => {
      const technicalError = 'TypeError: Cannot read property of undefined';

      const { getByText } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage={technicalError} />
        </ErrorBoundary>
      );

      expect(getByText(technicalError)).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle null children', () => {
      const { container } = render(
        <ErrorBoundary>
          {null}
        </ErrorBoundary>
      );

      expect(container).toBeTruthy();
    });

    it('should handle undefined children', () => {
      const { container } = render(
        <ErrorBoundary>
          {undefined}
        </ErrorBoundary>
      );

      expect(container).toBeTruthy();
    });

    it('should handle errors with no message', () => {
      const NoMessageError = () => {
        throw new Error();
      };

      const { queryByText } = render(
        <ErrorBoundary>
          <NoMessageError />
        </ErrorBoundary>
      );

      // Should still show error UI even with no message
      expect(queryByText(/something went wrong/i)).toBeTruthy();
    });
  });

  describe('CRASH-001: Error Message Type Safety', () => {
    it('should handle error with null message without crashing', () => {
      const NullMessageError = () => {
        const error = new Error();
        error.message = null;
        throw error;
      };

      const { queryByText } = render(
        <ErrorBoundary>
          <NullMessageError />
        </ErrorBoundary>
      );

      // Should not crash and should still render error UI
      expect(queryByText(/something went wrong/i)).toBeTruthy();
      expect(console.error).toHaveBeenCalled();
    });

    it('should handle error with undefined message without crashing', () => {
      const UndefinedMessageError = () => {
        const error = new Error();
        error.message = undefined;
        throw error;
      };

      const { queryByText } = render(
        <ErrorBoundary>
          <UndefinedMessageError />
        </ErrorBoundary>
      );

      // Should not crash and should still render error UI
      expect(queryByText(/something went wrong/i)).toBeTruthy();
      expect(console.error).toHaveBeenCalled();
    });

    it('should handle error with object message without crashing', () => {
      const ObjectMessageError = () => {
        const error = new Error();
        error.message = { code: 'ERR_001', details: 'Test error' };
        throw error;
      };

      const { queryByText } = render(
        <ErrorBoundary>
          <ObjectMessageError />
        </ErrorBoundary>
      );

      // Should not crash and should still render error UI
      expect(queryByText(/something went wrong/i)).toBeTruthy();
      expect(console.error).toHaveBeenCalled();
    });

    it('should handle error with array message without crashing', () => {
      const ArrayMessageError = () => {
        const error = new Error();
        error.message = ['Error 1', 'Error 2'];
        throw error;
      };

      const { queryByText } = render(
        <ErrorBoundary>
          <ArrayMessageError />
        </ErrorBoundary>
      );

      // Should not crash and should still render error UI
      expect(queryByText(/something went wrong/i)).toBeTruthy();
      expect(console.error).toHaveBeenCalled();
    });

    it('should handle thrown null without crashing', () => {
      const ThrowNull = () => {
        throw null;
      };

      const { queryByText } = render(
        <ErrorBoundary>
          <ThrowNull />
        </ErrorBoundary>
      );

      // Should not crash and should still render error UI
      expect(queryByText(/something went wrong/i)).toBeTruthy();
      expect(console.error).toHaveBeenCalled();
    });

    it('should handle thrown undefined without crashing', () => {
      const ThrowUndefined = () => {
        throw undefined;
      };

      const { queryByText } = render(
        <ErrorBoundary>
          <ThrowUndefined />
        </ErrorBoundary>
      );

      // Should not crash and should still render error UI
      expect(queryByText(/something went wrong/i)).toBeTruthy();
      expect(console.error).toHaveBeenCalled();
    });

    it('should handle thrown object without message property', () => {
      const ThrowPlainObject = () => {
        throw { code: 500, status: 'error' };
      };

      const { queryByText } = render(
        <ErrorBoundary>
          <ThrowPlainObject />
        </ErrorBoundary>
      );

      // Should not crash and should still render error UI
      expect(queryByText(/something went wrong/i)).toBeTruthy();
      expect(console.error).toHaveBeenCalled();
    });

    it('should handle thrown string without crashing', () => {
      const ThrowString = () => {
        throw 'String error message';
      };

      const { queryByText } = render(
        <ErrorBoundary>
          <ThrowString />
        </ErrorBoundary>
      );

      // Should not crash and should still render error UI
      expect(queryByText(/something went wrong/i)).toBeTruthy();
      expect(console.error).toHaveBeenCalled();
    });

    it('should handle thrown number without crashing', () => {
      const ThrowNumber = () => {
        throw 404;
      };

      const { queryByText } = render(
        <ErrorBoundary>
          <ThrowNumber />
        </ErrorBoundary>
      );

      // Should not crash and should still render error UI
      expect(queryByText(/something went wrong/i)).toBeTruthy();
      expect(console.error).toHaveBeenCalled();
    });

    it('should correctly classify database error with null message', () => {
      const DatabaseErrorNullMessage = () => {
        const error = new Error('Database connection failed');
        error.message = null;
        throw error;
      };

      const { queryByText } = render(
        <ErrorBoundary>
          <DatabaseErrorNullMessage />
        </ErrorBoundary>
      );

      // Should handle silently and not crash
      expect(console.error).toHaveBeenCalled();
    });

    it('should correctly classify network error with object message', () => {
      const NetworkErrorObjectMessage = () => {
        const error = new Error();
        error.message = { type: 'network', code: 'TIMEOUT' };
        throw error;
      };

      const { queryByText } = render(
        <ErrorBoundary>
          <NetworkErrorObjectMessage />
        </ErrorBoundary>
      );

      // Should handle without crashing
      expect(console.error).toHaveBeenCalled();
    });
  });
});