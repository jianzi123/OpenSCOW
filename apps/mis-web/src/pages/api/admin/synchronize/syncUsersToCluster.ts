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

import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { status } from "@grpc/grpc-js";
import { AdminServiceClient } from "@scow/protos/build/server/admin";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { PlatformRole } from "src/models/User";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";
import { handlegRPCError } from "src/utils/server";

export const SyncUsersToClusterSchema = typeboxRouteSchema({
  method: "POST",
  query: Type.Object({
    targetCluster: Type.String(),
  }),
  responses: {
    200: Type.Object({
      syncedAccountsCount: Type.Number(),
      syncedUsersCount: Type.Number(),
      failedAccounts: Type.Array(Type.String()),
      failedUsers: Type.Array(Type.String()),
    }),
    404: Type.Null(),
  },
});

const auth = authenticate((info) =>
  info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN),
);

export default route(SyncUsersToClusterSchema, async (req, res) => {
  const info = await auth(req, res);
  if (!info) { return; }

  const { targetCluster } = req.query;

  const client = getClient(AdminServiceClient);

  return await asyncClientCall(client, "syncUsersToCluster", {
    targetCluster,
  })
    .then((x) => ({ 200: x }))
    .catch(handlegRPCError({
      [status.NOT_FOUND]: () => ({ 404: null }),
    }));
});
