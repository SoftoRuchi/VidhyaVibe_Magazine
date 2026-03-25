'use client';
import { FilterOutlined } from '@ant-design/icons';
import { Card, Table, Tag, Select, Spin, Button, Badge, Space, Popover, Input } from 'antd';
import React from 'react';
import api from '../../../lib/api';

export default function SubscriptionsPage() {
  const PAGE_SIZE = 10;
  const [rows, setRows] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [searchText, setSearchText] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string | undefined>();
  const [planFilter, setPlanFilter] = React.useState<string | undefined>();
  const [magazineFilter, setMagazineFilter] = React.useState<string | undefined>();
  const [filtersOpen, setFiltersOpen] = React.useState(false);

  const load = () => {
    setLoading(true);
    api
      .get('/admin/subscriptions')
      .then((r) => setRows(r.data || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };

  React.useEffect(() => {
    load();
  }, []);

  const columns = [
    {
      title: 'S/N',
      key: 'serial',
      width: 70,
      render: (_: any, __: any, index: number) => (currentPage - 1) * PAGE_SIZE + index + 1,
    },
    { title: 'User', key: 'user', render: (_: any, r: any) => r.userEmail || r.userName || '-' },
    { title: 'Magazine', dataIndex: 'magazineTitle' },
    { title: 'Plan', dataIndex: 'planName' },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (s: any) => (
        <Tag color={s === 'ACTIVE' ? 'green' : s === 'CANCELLED' ? 'red' : 'default'}>{s}</Tag>
      ),
    },
    {
      title: 'Start',
      dataIndex: 'startsAt',
      render: (d: any) => (d ? new Date(d).toLocaleDateString() : '-'),
    },
    {
      title: 'End',
      dataIndex: 'endsAt',
      render: (d: any) => (d ? new Date(d).toLocaleDateString() : '-'),
    },
    {
      title: 'Amount',
      key: 'amount',
      render: (_: any, r: any) =>
        r.price != null ? `${Number(r.price).toFixed(2)} ${r.currency || 'USD'}` : '-',
    },
  ];

  const planOptions = React.useMemo(() => {
    const names = Array.from(
      new Set(rows.map((r: any) => String(r.planName || '').trim()).filter(Boolean)),
    );
    return names.map((name) => ({ value: name, label: name }));
  }, [rows]);

  const magazineOptions = React.useMemo(() => {
    const names = Array.from(
      new Set(rows.map((r: any) => String(r.magazineTitle || '').trim()).filter(Boolean)),
    );
    return names.map((name) => ({ value: name, label: name }));
  }, [rows]);

  const filteredRows = React.useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return rows.filter((r: any) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (planFilter && r.planName !== planFilter) return false;
      if (magazineFilter && r.magazineTitle !== magazineFilter) return false;
      if (!q) return true;

      const user = String(r.userEmail || r.userName || '').toLowerCase();
      const magazine = String(r.magazineTitle || '').toLowerCase();
      const plan = String(r.planName || '').toLowerCase();
      return user.includes(q) || magazine.includes(q) || plan.includes(q);
    });
  }, [rows, searchText, statusFilter, planFilter, magazineFilter]);

  const activeFilterCount = [searchText.trim(), statusFilter, planFilter, magazineFilter].filter(
    Boolean,
  ).length;

  const clearAllFilters = () => {
    setSearchText('');
    setStatusFilter(undefined);
    setPlanFilter(undefined);
    setMagazineFilter(undefined);
    setCurrentPage(1);
  };

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchText, statusFilter, planFilter, magazineFilter]);

  const filterContent = (
    <div style={{ width: 320 }}>
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>Filters</div>

        <div>
          <div style={{ marginBottom: 6, fontWeight: 500 }}>Search</div>
          <Input
            placeholder="Search by user, magazine, plan"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>

        <div>
          <div style={{ marginBottom: 6, fontWeight: 500 }}>Status</div>
          <Select
            placeholder="All Status"
            allowClear
            value={statusFilter}
            style={{ width: '100%' }}
            onChange={(v) => setStatusFilter(v)}
            options={[
              { value: 'ACTIVE', label: 'ACTIVE' },
              { value: 'PENDING', label: 'PENDING' },
              { value: 'CANCELLED', label: 'CANCELLED' },
              { value: 'EXPIRED', label: 'EXPIRED' },
            ]}
          />
        </div>

        <div>
          <div style={{ marginBottom: 6, fontWeight: 500 }}>Plan</div>
          <Select
            placeholder="All Plans"
            allowClear
            value={planFilter}
            style={{ width: '100%' }}
            onChange={(v) => setPlanFilter(v)}
            options={planOptions}
            showSearch
            optionFilterProp="label"
          />
        </div>

        <div>
          <div style={{ marginBottom: 6, fontWeight: 500 }}>Magazine</div>
          <Select
            placeholder="All Magazines"
            allowClear
            value={magazineFilter}
            style={{ width: '100%' }}
            onChange={(v) => setMagazineFilter(v)}
            options={magazineOptions}
            showSearch
            optionFilterProp="label"
          />
        </div>

        <Button danger block onClick={clearAllFilters}>
          Clear All Filters
        </Button>
      </Space>
    </div>
  );

  return (
    <main>
      <Card
        title="Subscriptions"
        extra={
          <Popover
            trigger="click"
            placement="bottomRight"
            open={filtersOpen}
            onOpenChange={setFiltersOpen}
            content={filterContent}
          >
            <Badge count={activeFilterCount} size="small">
              <Button icon={<FilterOutlined />}>Filters</Button>
            </Badge>
          </Popover>
        }
      >
        {loading ? (
          <Spin />
        ) : (
          <Table
            rowKey="id"
            dataSource={filteredRows}
            columns={columns}
            pagination={{ pageSize: PAGE_SIZE, current: currentPage }}
            onChange={(pagination) => setCurrentPage(pagination.current || 1)}
          />
        )}
      </Card>
    </main>
  );
}
