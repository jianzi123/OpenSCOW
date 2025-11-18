/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * OpenSCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Logger } from "@ddadaal/tsgrpc-server";
import { SqlEntityManager } from "@mikro-orm/mysql";
import { ClusterConfigSchema } from "@scow/config/build/cluster";
import { Account } from "src/entities/Account";
import { UserAccount, UserRole, UserStatus } from "src/entities/UserAccount";
import { ClusterPlugin } from "src/plugins/clusters";

export interface SyncUsersToClusterResult {
  syncedAccountsCount: number;
  syncedUsersCount: number;
  failedAccounts: string[];
  failedUsers: string[];
}

/**
 * Synchronize all accounts and users from SCOW database to a target cluster
 * This is useful when adding a new cluster to the multi-cluster setup
 */
export async function syncUsersToCluster(
  em: SqlEntityManager,
  targetCluster: string,
  targetClusterConfig: ClusterConfigSchema,
  clusterPlugin: ClusterPlugin["clusters"],
  logger: Logger,
): Promise<SyncUsersToClusterResult> {

  const failedAccounts: string[] = [];
  const failedUsers: string[] = [];
  let syncedAccountsCount = 0;
  let syncedUsersCount = 0;

  logger.info(`Starting to sync users to cluster ${targetCluster}`);

  // Get all accounts from database
  const accounts = await em.find(Account, {}, { populate: ["users", "users.user"]});

  logger.info(`Found ${accounts.length} accounts in database`);

  // Sync each account to the target cluster
  for (const account of accounts) {
    try {
      logger.info(`Syncing account ${account.accountName} to cluster ${targetCluster}`);

      // Get account users
      const userAccounts = await em.find(UserAccount, {
        account: { accountName: account.accountName },
      }, { populate: ["user", "account"]});

      // Find the owner
      const ownerUserAccount = userAccounts.find((ua) => ua.role === UserRole.OWNER);

      if (!ownerUserAccount) {
        logger.warn(`Account ${account.accountName} has no owner, skipping`);
        failedAccounts.push(account.accountName);
        continue;
      }

      const owner = ownerUserAccount.user.$.userId;
      const users = userAccounts.map((ua) => ({
        userId: ua.user.$.userId,
        userName: ua.user.$.name,
      }));

      logger.info(`Account ${account.accountName} has ${users.length} users, owner: ${owner}`);

      // Call adapter to create account with users
      await clusterPlugin.callOnOne(
        targetCluster,
        logger,
        async (client) => {
          // First, check if account already exists
          const existingAccounts = await asyncClientCall(client.account, "getAllAccountsWithUsers", {});
          const accountExists = existingAccounts.accounts.some((a) => a.accountName === account.accountName);

          if (!accountExists) {
            // Create account if it doesn't exist
            logger.info(`Creating account ${account.accountName} in cluster ${targetCluster}`);
            await asyncClientCall(client.account, "createAccount", {
              accountName: account.accountName,
              ownerUserId: owner,
            });
            syncedAccountsCount++;
          } else {
            logger.info(`Account ${account.accountName} already exists in cluster ${targetCluster}`);
          }

          // Add users to account
          for (const user of users) {
            try {
              // Check if user exists in account
              const existingAccount = existingAccounts.accounts.find((a) => a.accountName === account.accountName);
              const userExists = existingAccount?.users.some((u) => u.userId === user.userId);

              if (!userExists) {
                logger.info(`Adding user ${user.userId} to account ${account.accountName} in cluster ${targetCluster}`);
                await asyncClientCall(client.user, "addUserToAccount", {
                  accountName: account.accountName,
                  userId: user.userId,
                });
                syncedUsersCount++;
              } else {
                logger.info(
                  `User ${user.userId} already exists in account ${account.accountName} in cluster ${targetCluster}`,
                );
              }

              // Sync block status
              const userAccount = userAccounts.find((ua) => ua.user.$.userId === user.userId);
              if (userAccount && userAccount.blockedInCluster === UserStatus.BLOCKED) {
                logger.info(
                  `Blocking user ${user.userId} in account ${account.accountName} in cluster ${targetCluster}`,
                );
                await asyncClientCall(client.user, "blockUserInAccount", {
                  accountName: account.accountName,
                  userId: user.userId,
                });
              }
            } catch (userError) {
              logger.warn(
                `Failed to add/sync user ${user.userId} to account ${account.accountName} ` +
                `in cluster ${targetCluster}: %o`,
                userError,
              );
              failedUsers.push(`${user.userId}@${account.accountName}`);
            }
          }

          // Sync account block status
          if (account.blockedInCluster) {
            logger.info(`Blocking account ${account.accountName} in cluster ${targetCluster}`);
            await asyncClientCall(client.account, "blockAccount", {
              accountName: account.accountName,
            });
          }
        },
      );

      logger.info(`Successfully synced account ${account.accountName} to cluster ${targetCluster}`);
    } catch (accountError) {
      logger.error(`Failed to sync account ${account.accountName} to cluster ${targetCluster}: %o`, accountError);
      failedAccounts.push(account.accountName);
    }
  }

  logger.info(
    `Sync completed. Synced ${syncedAccountsCount} accounts, ${syncedUsersCount} users. ` +
    `Failed accounts: ${failedAccounts.length}, Failed users: ${failedUsers.length}`,
  );

  return {
    syncedAccountsCount,
    syncedUsersCount,
    failedAccounts,
    failedUsers,
  };
}
