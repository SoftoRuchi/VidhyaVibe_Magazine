'use client';
import { FilterOutlined } from '@ant-design/icons';
import { Card, Table, Spin, Button, Badge, Popover, Input, Select, Space } from 'antd';
import React from 'react';
import api from '../../../lib/api';

export default function ReadersPage() {
  const PAGE_SIZE = 10;
  const [rows, setRows] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [searchText, setSearchText] = React.useState('');
  const [classFilter, setClassFilter] = React.useState<string | undefined>();
  const [cityFilter, setCityFilter] = React.useState<string | undefined>();

  React.useEffect(() => {
    api
      .get('/admin/readers')
      .then((r) => setRows(r.data || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  const columns = [
    {
      title: 'S/N',
      key: 'serial',
      width: 70,
      render: (_: any, __: any, index: number) => (currentPage - 1) * PAGE_SIZE + index + 1,
    },
    { title: 'Name', dataIndex: 'name' },
    { title: 'User Email', dataIndex: 'userEmail' },
    { title: 'Age', dataIndex: 'age', width: 70 },
    { title: 'Class', dataIndex: 'className', width: 100 },
    { title: 'School', dataIndex: 'schoolName' },
    { title: 'City', dataIndex: 'schoolCity', width: 120 },
  ];

  const classOptions = React.useMemo(() => {
    const values = Array.from(
      new Set(rows.map((r: any) => String(r.className || '').trim()).filter(Boolean)),
    );
    return values.map((v) => ({ value: v, label: v }));
  }, [rows]);

  const cityOptions = React.useMemo(() => {
    const values = Array.from(
      new Set(rows.map((r: any) => String(r.schoolCity || '').trim()).filter(Boolean)),
    );
    return values.map((v) => ({ value: v, label: v }));
  }, [rows]);

  const filteredRows = React.useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return rows.filter((r: any) => {
      if (classFilter && r.className !== classFilter) return false;
      if (cityFilter && r.schoolCity !== cityFilter) return false;
      if (!q) return true;
      return [r.name, r.userEmail, r.schoolName, r.schoolCity, r.className]
        .map((x) => String(x || '').toLowerCase())
        .some((x) => x.includes(q));
    });
  }, [rows, searchText, classFilter, cityFilter]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchText, classFilter, cityFilter]);

  const activeFilterCount = [searchText.trim(), classFilter, cityFilter].filter(Boolean).length;

  const clearAllFilters = () => {
    setSearchText('');
    setClassFilter(undefined);
    setCityFilter(undefined);
    setCurrentPage(1);
  };

  const filterContent = (
    <div style={{ width: 320 }}>
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>Filters</div>
        <div>
          <div style={{ marginBottom: 6, fontWeight: 500 }}>Search</div>
          <Input
            placeholder="Search by name, email, school, city"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
        <div>
          <div style={{ marginBottom: 6, fontWeight: 500 }}>Class</div>
          <Select
            placeholder="All Classes"
            allowClear
            value={classFilter}
            style={{ width: '100%' }}
            onChange={(v) => setClassFilter(v)}
            options={classOptions}
            showSearch
            optionFilterProp="label"
          />
        </div>
        <div>
          <div style={{ marginBottom: 6, fontWeight: 500 }}>City</div>
          <Select
            placeholder="All Cities"
            allowClear
            value={cityFilter}
            style={{ width: '100%' }}
            onChange={(v) => setCityFilter(v)}
            options={cityOptions}
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
        title="Readers"
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
