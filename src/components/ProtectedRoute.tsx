import React from 'react';

interface ProtectedRouteProps {
  isAuthenticated: boolean;
  isLoading?: boolean;
  requiresProfileCompleted?: boolean;
  isProfileCompleted?: boolean;
  fallback: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Squadly Protected Route Guard
 * Shields views from unauthenticated visitors and verifies profile onboarding status.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  isAuthenticated,
  isLoading = false,
  requiresProfileCompleted = false,
  isProfileCompleted = true,
  fallback,
  children,
}) => {
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-[#6C2BD9] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-500">Checking session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <>{fallback}</>;
  }

  if (requiresProfileCompleted && !isProfileCompleted) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

interface AdminProtectedRouteProps {
  isAdminAuthenticated: boolean;
  fallback: React.ReactNode;
  children: React.ReactNode;
}

export const AdminProtectedRoute: React.FC<AdminProtectedRouteProps> = ({
  isAdminAuthenticated,
  fallback,
  children,
}) => {
  if (!isAdminAuthenticated) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
};
