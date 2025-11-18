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

import { ClusterActivationStatus } from "@scow/config/build/type";
import { Card, Select, Table } from "antd";
import type { NextPage } from "next";
import { useState } from "react";
import { useAsync } from "react-async";
import { api } from "src/apis";
import { requireAuth } from "src/auth/requireAuth";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { PlatformRole } from "src/models/User";
import { Head } from "src/utils/head";

const p = prefix("page.admin.resourceManagement.partitionManagement.");
const pTable = prefix("page.admin.resourceManagement.partitionManagement.table.");

export const PartitionManagementPage: NextPage = requireAuth(
  (u) => u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN),
)(
  () => {
    const t = useI18nTranslateToString();

    const [selectedCluster, setSelectedCluster] = useState<string | undefined>();

    const { data, isLoading, reload } = useAsync({
      promiseFn: async () => api.getPartitions({ query: { cluster: selectedCluster } }),
      watch: selectedCluster,
    });

    const { data: clustersData } = useAsync({
      promiseFn: async () => api.getClustersRuntimeInfo({ query: {} }),
    });

    const activatedClusters = clustersData?.results.filter(
      (x) => x.activationStatus === ClusterActivationStatus.ACTIVATED,
    ) ?? [];

    const tableData = data?.clusters.flatMap((cluster) =>
      cluster.partitions.map((partition) => ({
        key: `${cluster.cluster}-${partition.name}`,
        clusterName: cluster.cluster,
        partitionName: partition.name,
        nodes: partition.nodes,
        cores: partition.cores,
        gpus: partition.gpus,
        memMb: partition.memMb,
        qos: partition.qos.join(", "),
        comment: partition.comment || "-",
      })),
    ) ?? [];

    const columns = [
      {
        title: t(pTable("clusterName")),
        dataIndex: "clusterName",
        key: "clusterName",
        width: 150,
      },
      {
        title: t(pTable("partitionName")),
        dataIndex: "partitionName",
        key: "partitionName",
        width: 150,
      },
      {
        title: t(pTable("nodes")),
        dataIndex: "nodes",
        key: "nodes",
        width: 100,
      },
      {
        title: t(pTable("cores")),
        dataIndex: "cores",
        key: "cores",
        width: 100,
      },
      {
        title: t(pTable("gpus")),
        dataIndex: "gpus",
        key: "gpus",
        width: 100,
      },
      {
        title: t(pTable("memMb")),
        dataIndex: "memMb",
        key: "memMb",
        width: 120,
        render: (value: number) => `${value} MB`,
      },
      {
        title: t(pTable("qos")),
        dataIndex: "qos",
        key: "qos",
        width: 200,
      },
      {
        title: t(pTable("comment")),
        dataIndex: "comment",
        key: "comment",
      },
    ];

    return (
      <div>
        <Head title={t(p("title"))} />
        <PageTitle titleText={t(p("title"))} isLoading={isLoading} reload={reload} />

        <Card style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 16 }}>
            <span style={{ marginRight: 8 }}>{t(p("clusterFilter"))}:</span>
            <Select
              style={{ width: 300 }}
              placeholder={t(p("allClusters"))}
              allowClear
              value={selectedCluster}
              onChange={setSelectedCluster}
              options={[
                {
                  value: undefined,
                  label: t(p("allClusters")),
                },
                ...activatedClusters.map((c) => ({
                  value: c.clusterId,
                  label: c.clusterId,
                })),
              ]}
            />
          </div>

          <Table
            columns={columns}
            dataSource={tableData}
            loading={isLoading}
            pagination={{ pageSize: 20 }}
            scroll={{ x: true }}
            locale={{
              emptyText: t(p("noData")),
            }}
          />
        </Card>
      </div>
    );
  },
);

export default PartitionManagementPage;
