import { useState, useCallback, useMemo } from 'react';
import { Users, ShieldOff, ShieldCheck, Unlock, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PageError } from '@/components/shared/error-state';
import { EmptyState } from '@/components/shared/empty-state';
import { useAdminUsers, useUpdateUserStatus, useForceLogout } from '@/hooks/use-admin';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/use-page-title';
import type { components } from '@/api/generated/types';

type AdminUser = components['schemas']['AdminUser'];
type Role = AdminUser['role'];
type Status = AdminUser['status'];

const PAGE_SIZE = 20;

const ROLES: Role[] = ['PASSENGER', 'PROVIDER', 'DRIVER', 'ADMIN'];
const STATUSES: Status[] = ['ACTIVE', 'SUSPENDED', 'LOCKED'];

/** Maps user status to badge variant. */
function getStatusVariant(status: Status): 'default' | 'destructive' | 'secondary' {
  switch (status) {
    case 'ACTIVE':
      return 'default';
    case 'SUSPENDED':
      return 'destructive';
    case 'LOCKED':
      return 'secondary';
  }
}

/** Maps user role to badge variant. */
function getRoleVariant(role: Role): 'default' | 'secondary' | 'outline' {
  switch (role) {
    case 'ADMIN':
      return 'default';
    case 'PROVIDER':
      return 'secondary';
    default:
      return 'outline';
  }
}

/* ---------- Confirmation Dialog ---------- */

/** Action configuration for the confirmation dialog. */
interface ConfirmAction {
  /** User targeted by this action. */
  user: AdminUser;
  /** Type of action to perform. */
  type: 'suspend' | 'unsuspend' | 'unlock' | 'force-logout';
}

/** Maps action type to i18n key prefix. */
const ACTION_KEY_MAP: Record<
  ConfirmAction['type'],
  { titleKey: string; descKey: string; buttonKey: string; destructive: boolean }
> = {
  suspend: {
    titleKey: 'users.confirm.suspendTitle',
    descKey: 'users.confirm.suspendDescription',
    buttonKey: 'users.actions.suspend',
    destructive: true,
  },
  unsuspend: {
    titleKey: 'users.confirm.unsuspendTitle',
    descKey: 'users.confirm.unsuspendDescription',
    buttonKey: 'users.actions.unsuspend',
    destructive: false,
  },
  unlock: {
    titleKey: 'users.confirm.unlockTitle',
    descKey: 'users.confirm.unlockDescription',
    buttonKey: 'users.actions.unlock',
    destructive: false,
  },
  'force-logout': {
    titleKey: 'users.confirm.forceLogoutTitle',
    descKey: 'users.confirm.forceLogoutDescription',
    buttonKey: 'users.actions.forceLogout',
    destructive: true,
  },
};

/** Props for {@link UserConfirmDialog}. */
interface UserConfirmDialogProps {
  /** The action to confirm, or null if dialog is closed. */
  action: ConfirmAction | null;
  /** Whether a mutation is in progress. */
  isPending: boolean;
  /** Callback when user confirms the action. */
  onConfirm: () => void;
  /** Callback when dialog is dismissed. */
  onCancel: () => void;
}

/**
 * Confirmation dialog for user management actions (suspend, unsuspend, unlock, force-logout).
 *
 * Shows a warning with the target user's name and a description of what the action will do.
 */
function UserConfirmDialog({ action, isPending, onConfirm, onCancel }: UserConfirmDialogProps) {
  const { t } = useTranslation('admin');
  if (!action) return null;
  const config = ACTION_KEY_MAP[action.type];

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(config.titleKey)}</DialogTitle>
          <DialogDescription>
            {t(config.descKey)}{' '}
            {t('users.confirm.appliesTo', { name: action.user.name, email: action.user.email })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isPending}>
            {t('users.confirm.cancel')}
          </Button>
          <Button
            variant={config.destructive ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? t('users.confirm.processing') : t(config.buttonKey)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Filter Bar ---------- */

/** Props for {@link UserFilterBar}. */
interface UserFilterBarProps {
  /** Currently selected role filter. */
  role: Role | '';
  /** Currently selected status filter. */
  status: Status | '';
  /** Callback when role filter changes. */
  onRoleChange: (role: Role | '') => void;
  /** Callback when status filter changes. */
  onStatusChange: (status: Status | '') => void;
}

/**
 * Filter bar with role and status dropdowns for the admin user list.
 */
function UserFilterBar({ role, status, onRoleChange, onStatusChange }: UserFilterBarProps) {
  const { t } = useTranslation('admin');
  return (
    <div className="mb-6 flex flex-wrap gap-4" role="group" aria-label={t('users.filtersLabel')}>
      <div className="flex items-center gap-2">
        <label htmlFor="role-filter" className="text-sm font-medium">
          {t('users.roleLabel')}
        </label>
        <select
          id="role-filter"
          className="rounded-md border bg-background px-3 py-1.5 text-sm"
          value={role}
          onChange={(e) => onRoleChange(e.target.value as Role | '')}
        >
          <option value="">{t('users.allRoles')}</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {t(`users.roles.${r}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="status-filter" className="text-sm font-medium">
          {t('users.statusLabel')}
        </label>
        <select
          id="status-filter"
          className="rounded-md border bg-background px-3 py-1.5 text-sm"
          value={status}
          onChange={(e) => onStatusChange(e.target.value as Status | '')}
        >
          <option value="">{t('users.allStatuses')}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`users.statuses.${s}`)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

/* ---------- Loading Skeleton ---------- */

/** Skeleton placeholder for the user list while loading. */
function UserListSkeleton() {
  const { t } = useTranslation('admin');
  return (
    <div className="space-y-4" aria-busy="true" aria-label={t('users.loadingLabel')}>
      {Array.from({ length: 5 }, (_, i) => (
        <Card key={i}>
          <CardContent className="flex items-center gap-4 p-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="ml-auto h-8 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ---------- User Row ---------- */

/** Props for {@link UserRow}. */
interface UserRowProps {
  /** User data to display. */
  user: AdminUser;
  /** Whether this is the current admin user. */
  isSelf: boolean;
  /** Callback when an action is requested on this user. */
  onAction: (action: ConfirmAction) => void;
}

/**
 * Renders a single user row with info badges and action buttons.
 *
 * Disables action buttons for the current admin's own row.
 */
function UserRow({ user, isSelf, onAction }: UserRowProps) {
  const { t } = useTranslation('admin');
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{user.name}</p>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          {user.providerId && (
            <p className="text-xs text-muted-foreground">
              {t('users.providerPrefix', { id: user.providerId })}
            </p>
          )}
        </div>
        <Badge variant={getRoleVariant(user.role)}>{t(`users.roles.${user.role}`)}</Badge>
        <Badge variant={getStatusVariant(user.status)}>{t(`users.statuses.${user.status}`)}</Badge>
        <time className="hidden text-xs text-muted-foreground sm:block" dateTime={user.createdAt}>
          {new Date(user.createdAt).toLocaleDateString()}
        </time>
        <UserActions user={user} isSelf={isSelf} onAction={onAction} />
      </CardContent>
    </Card>
  );
}

/* ---------- User Actions ---------- */

/** Props for {@link UserActions}. */
interface UserActionsProps {
  /** User data. */
  user: AdminUser;
  /** Whether this is the current admin user. */
  isSelf: boolean;
  /** Callback when an action is requested. */
  onAction: (action: ConfirmAction) => void;
}

/**
 * Action buttons for a user row: suspend/unsuspend, unlock, force logout.
 *
 * All buttons are disabled when targeting the current admin's own account.
 */
function UserActions({ user, isSelf, onAction }: UserActionsProps) {
  const { t } = useTranslation('admin');
  return (
    <div className="flex gap-1">
      {user.status === 'ACTIVE' && (
        <Button
          variant="ghost"
          size="sm"
          disabled={isSelf}
          title={isSelf ? t('users.tooltips.cannotSuspendSelf') : t('users.tooltips.suspendUser')}
          aria-label={`${t('users.actions.suspend')} ${user.name}`}
          onClick={() => onAction({ user, type: 'suspend' })}
        >
          <ShieldOff className="mr-1 h-4 w-4" aria-hidden="true" />
          {t('users.actions.suspend')}
        </Button>
      )}
      {user.status === 'SUSPENDED' && (
        <Button
          variant="ghost"
          size="sm"
          disabled={isSelf}
          title={
            isSelf ? t('users.tooltips.cannotUnsuspendSelf') : t('users.tooltips.unsuspendUser')
          }
          aria-label={`${t('users.actions.unsuspend')} ${user.name}`}
          onClick={() => onAction({ user, type: 'unsuspend' })}
        >
          <ShieldCheck className="mr-1 h-4 w-4" aria-hidden="true" />
          {t('users.actions.unsuspend')}
        </Button>
      )}
      {user.status === 'LOCKED' && (
        <Button
          variant="ghost"
          size="sm"
          disabled={isSelf}
          title={isSelf ? t('users.tooltips.cannotUnlockSelf') : t('users.tooltips.unlockUser')}
          aria-label={`${t('users.actions.unlock')} ${user.name}`}
          onClick={() => onAction({ user, type: 'unlock' })}
        >
          <Unlock className="mr-1 h-4 w-4" aria-hidden="true" />
          {t('users.actions.unlock')}
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        disabled={isSelf}
        title={
          isSelf ? t('users.tooltips.cannotForceLogoutSelf') : t('users.tooltips.forceLogoutUser')
        }
        aria-label={`${t('users.actions.forceLogout')} ${user.name}`}
        onClick={() => onAction({ user, type: 'force-logout' })}
      >
        <LogOut className="mr-1 h-4 w-4" aria-hidden="true" />
        {t('users.actions.logout')}
      </Button>
    </div>
  );
}

/* ---------- Pagination ---------- */

/** Props for {@link UserPagination}. */
interface UserPaginationProps {
  /** Current page number. */
  page: number;
  /** Total number of pages. */
  totalPages: number;
  /** Callback to change page. */
  onPageChange: (page: number) => void;
}

/** Pagination controls for the user list. */
function UserPagination({ page, totalPages, onPageChange }: UserPaginationProps) {
  const { t } = useTranslation('admin');
  return (
    <nav className="mt-8 flex items-center justify-center gap-4" aria-label="User list pagination">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        {t('pagination.previous')}
      </Button>
      <span className="text-sm text-muted-foreground">
        {t('pagination.pageOf', { page, totalPages })}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        {t('pagination.next')}
      </Button>
    </nav>
  );
}

/* ---------- User List Content ---------- */

/** Props for {@link UserListContent}. */
interface UserListContentProps {
  /** Whether data is loading. */
  isLoading: boolean;
  /** Whether there was a fetch error. */
  isError: boolean;
  /** The list of users. */
  users: AdminUser[];
  /** ID of the current authenticated user. */
  currentUserId: string;
  /** Retry callback for error state. */
  onRetry: () => void;
  /** Callback when a user action is requested. */
  onAction: (action: ConfirmAction) => void;
}

/** Renders the appropriate user list content based on query state. */
function UserListContent({
  isLoading,
  isError,
  users,
  currentUserId,
  onRetry,
  onAction,
}: UserListContentProps) {
  const { t } = useTranslation('admin');
  if (isLoading) return <UserListSkeleton />;
  if (isError) {
    return (
      <PageError
        title={t('users.error.title')}
        message={t('users.error.message')}
        onRetry={onRetry}
      />
    );
  }
  if (users.length === 0) {
    return (
      <EmptyState icon={Users} title={t('users.empty.title')} message={t('users.empty.message')} />
    );
  }
  return (
    <div className="space-y-3">
      {users.map((user) => (
        <UserRow key={user.id} user={user} isSelf={user.id === currentUserId} onAction={onAction} />
      ))}
    </div>
  );
}

/* ---------- Page ---------- */

/**
 * Admin user management page.
 *
 * Displays a paginated list of all platform users with role and status filters.
 * Admins can suspend, unsuspend, unlock, or force-logout users. Actions on the
 * current admin's own account are disabled. All destructive actions require
 * confirmation via dialog.
 *
 * @example
 * ```
 * // Route: /admin/users (requires ADMIN role)
 * <AdminUsersPage />
 * ```
 */
export default function AdminUsersPage() {
  const { t } = useTranslation('admin');
  usePageTitle(t('users.title'));
  const { user: currentUser } = useAuth();
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState<Role | ''>('');
  const [statusFilter, setStatusFilter] = useState<Status | ''>('');
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const usersQuery = useAdminUsers({
    page,
    pageSize: PAGE_SIZE,
    role: roleFilter || undefined,
    status: statusFilter || undefined,
  });

  const updateStatus = useUpdateUserStatus();
  const forceLogout = useForceLogout();

  const users = useMemo(() => usersQuery.data?.data ?? [], [usersQuery.data]);
  const totalPages = usersQuery.data?.meta?.totalPages ?? 1;

  const handleRoleChange = useCallback((role: Role | '') => {
    setRoleFilter(role);
    setPage(1);
  }, []);

  const handleStatusChange = useCallback((status: Status | '') => {
    setStatusFilter(status);
    setPage(1);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!confirmAction) return;
    const { user: targetUser, type } = confirmAction;

    if (type === 'force-logout') {
      forceLogout.mutate({ id: targetUser.id }, { onSettled: () => setConfirmAction(null) });
    } else {
      updateStatus.mutate(
        { id: targetUser.id, action: type },
        { onSettled: () => setConfirmAction(null) },
      );
    }
  }, [confirmAction, forceLogout, updateStatus]);

  const isPending = updateStatus.isPending || forceLogout.isPending;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">{t('users.title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('users.subtitle')}</p>
      </div>

      <UserFilterBar
        role={roleFilter}
        status={statusFilter}
        onRoleChange={handleRoleChange}
        onStatusChange={handleStatusChange}
      />

      <section aria-labelledby="admin-users-heading">
        <h2 id="admin-users-heading" className="sr-only">
          {t('users.heading')}
        </h2>
        <UserListContent
          isLoading={usersQuery.isLoading}
          isError={usersQuery.isError && !usersQuery.data}
          users={users}
          currentUserId={currentUser?.id ?? ''}
          onRetry={() => usersQuery.refetch()}
          onAction={setConfirmAction}
        />
      </section>

      {totalPages > 1 && (
        <UserPagination page={page} totalPages={totalPages} onPageChange={setPage} />
      )}

      <UserConfirmDialog
        action={confirmAction}
        isPending={isPending}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
