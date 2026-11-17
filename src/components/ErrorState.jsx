import { Alert, AlertIcon, AlertTitle, AlertDescription, Box, Button } from '@chakra-ui/react';
import { RepeatIcon } from '@chakra-ui/icons';

/**
 * Shared error message with an optional retry button (omit onRetry to hide it).
 *
 * @param {Object}    props
 * @param {string}    [props.title]
 * @param {string}    [props.message]
 * @param {() => void} [props.onRetry]
 * @param {string}    [props.retryLabel]
 * @param {'error' | 'warning' | 'info' | 'success'} [props.status]
 * @param {boolean}   [props.isRetrying]
 */
export default function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry = undefined,
  retryLabel = 'Retry',
  status = 'error',
  isRetrying = false,
  ...rest
}) {
  return (
    <Alert status={status} borderRadius="lg" {...rest}>
      <AlertIcon />
      <Box flex="1">
        <AlertTitle>{title}</AlertTitle>
        {message && <AlertDescription>{message}</AlertDescription>}
      </Box>
      {onRetry && (
        <Button
          leftIcon={<RepeatIcon />}
          size="sm"
          onClick={onRetry}
          isLoading={isRetrying}
          colorScheme="brand"
          variant="outline"
          ml={3}
          flexShrink={0}
        >
          {retryLabel}
        </Button>
      )}
    </Alert>
  );
}
