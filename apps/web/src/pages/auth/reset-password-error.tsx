import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

/** Props for the invalid/expired token error view. */
interface TokenErrorProps {
  /** Whether the token has expired (vs being invalid/missing). */
  expired: boolean;
}

/** Displays an error when the reset password token is invalid or expired. */
export function TokenErrorView({ expired }: TokenErrorProps) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="glass-card w-full max-w-md">
        <CardContent className="pt-6 text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-destructive" aria-hidden="true" />
          <h1 className="mb-2 text-2xl font-semibold">
            {expired ? 'Link expired' : 'Invalid link'}
          </h1>
          <p className="mb-6 text-sm text-muted-foreground">
            {expired
              ? 'This password reset link has expired. Please request a new one.'
              : 'This password reset link is invalid. Please request a new one.'}
          </p>
          <Link to="/auth/forgot-password" className="text-sm text-primary hover:underline">
            Request a new reset link
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
