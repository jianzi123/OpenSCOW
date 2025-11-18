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

import { ExclamationCircleOutlined } from "@ant-design/icons";
import { ClusterActivationStatus } from "@scow/config/build/type";
import { Alert, App, Button, Card, Descriptions, Select } from "antd";
import type { NextPage } from "next";
import { useState } from "react";
import { useAsync } from "react-async";
import { api } from "src/apis";
import { requireAuth } from "src/auth/requireAuth";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { PlatformRole } from "src/models/User";
import { Head } from "src/utils/head";

const p = prefix("page.admin.systemDebug.syncUsersToCluster.");

export const SyncUsersToClusterPage: NextPage = requireAuth(
  (u) => u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN),
)(
  () => {
    const t = useI18nTranslateToString();
    const { message, modal } = App.useApp();

    const [selectedCluster, setSelectedCluster] = useState<string | undefined>();
    const [syncing, setSyncing] = useState(false);

    const { data: clustersData, isLoading, reload } = useAsync({
      promiseFn: async () => api.getClustersRuntimeInfo({ query: {} }),
    });

    const activatedClusters = clustersData?.results.filter(
      (x) => x.activationStatus === ClusterActivationStatus.ACTIVATED,
    ) ?? [];

    const handleSync = () => {
      if (!selectedCluster) {
        message.warning(t(p("selectTargetCluster")));
        return;
      }

      const clusterName = selectedCluster;

      modal.confirm({
        title: t(p("confirmSync")),
        icon: <ExclamationCircleOutlined />,
        content: t(p("confirmSyncMessage"), [clusterName]),
        onOk: async () => {
          setSyncing(true);
          return api.syncUsersToCluster({ query: { targetCluster: selectedCluster } })
            .httpError(404, () => {
              message.error(t(p("noActivatedCluster")));
            })
            .then(({ failedAccounts, failedUsers, syncedAccountsCount, syncedUsersCount }) => {
              if (failedAccounts.length === 0 && failedUsers.length === 0) {
                modal.success({
                  title: t(p("syncSuccess")),
                  content: t(p("syncSuccessMessage"), [syncedAccountsCount, syncedUsersCount, clusterName]),
                });
              } else {
                modal.warning({
                  title: t(p("partialSyncWarning")),
                  content: (
                    <div>
                      <p>{t(p("syncSuccessMessage"), [syncedAccountsCount, syncedUsersCount, clusterName])}</p>
                      {failedAccounts.length > 0 && (
                        <div>
                          <strong>{t(p("failedAccounts"))}:</strong>
                          <p>{failedAccounts.join(", ")}</p>
                        </div>
                      )}
                      {failedUsers.length > 0 && (
                        <div>
                          <strong>{t(p("failedUsers"))}:</strong>
                          <p>{failedUsers.join(", ")}</p>
                        </div>
                      )}
                    </div>
                  ),
                });
              }
            })
            .finally(() => {
              setSyncing(false);
            });
        },
      });
    };

    return (
      <div>
        <Head title={t(p("title"))} />
        <PageTitle titleText={t(p("title"))} isLoading={isLoading} reload={reload} />

        <Alert
          type="info"
          message={t(p("alertInfo"))}
          style={{ marginBottom: 16 }}
        />

        <Card>
          <Descriptions bordered column={1}>
            <Descriptions.Item label={t(p("targetCluster"))}>
              <Select
                style={{ width: "100%", maxWidth: 400 }}
                placeholder={t(p("selectTargetCluster"))}
                value={selectedCluster}
                onChange={setSelectedCluster}
                loading={isLoading}
                disabled={syncing}
                options={activatedClusters.map((c) => ({
                  value: c.clusterId,
                  label: c.clusterId,
                }))}
              />
            </Descriptions.Item>
          </Descriptions>

          <Button
            type="primary"
            loading={syncing}
            onClick={handleSync}
            disabled={!selectedCluster}
            style={{ marginTop: 16 }}
          >
            {t(p("syncButton"))}
          </Button>
        </Card>
      </div>
    );
  },
);

export default SyncUsersToClusterPage;
