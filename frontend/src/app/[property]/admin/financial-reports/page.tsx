'use client';

/**
 * Financial Reporting Pack
 * 
 * Paginated, printable reports for operational and financial documents.
 * Pattern: Power BI Paginated Reports, SSRS, printable financial statements
 * 
 * Separate from the interactive cockpit - this is for:
 * - Printable revenue statements
 * - Cost detail reports
 * - Budget vs Actual
 * - Margin bridges
 * - Audit documents
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Printer, Download, FileText, FileSpreadsheet } from 'lucide-react';

interface ReportRow {
  date: string;
  description: string;
  category: string;
  amount: number;
  status: string;
  reference?: string;
}

interface FinancialReport {
  summary: {
    total_revenue: number;
    total_costs: number;
    gross_margin: number;
    gross_margin_percent: number;
    booking_count: number;
    average_value: number;
  };
  rows: ReportRow[];
  footnotes: string[];
}

export default function FinancialReports() {
  const [reportType, setReportType] = useState<string>('revenue_detail');
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({
    from: new Date(new Date().setDate(1)), // Start of month
    to: new Date()
  });
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<FinancialReport | null>(null);

  const generateReport = async () => {
    if (!dateRange.from || !dateRange.to) {
      toast.error('Please select a date range');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/analytics/reports/financial', {
        reportType,
        period: {
          start: dateRange.from.toISOString(),
          end: dateRange.to.toISOString()
        }
      });
      setReport(data);
    } catch {
      toast.error('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const exportReport = (format: 'pdf' | 'excel' | 'csv') => {
    toast.success(`Exporting as ${format.toUpperCase()}...`);
    // Implementation would call export endpoint
  };

  const reportTypes = [
    { value: 'revenue_detail', label: 'Revenue Detail Report', description: 'Line-by-line revenue with sources and channels' },
    { value: 'cost_detail', label: 'Cost Detail Report', description: 'Operational costs and expenses' },
    { value: 'margin_bridge', label: 'Margin Bridge Analysis', description: 'Revenue to margin walk with drivers' },
    { value: 'budget_variance', label: 'Budget vs Actual', description: 'Performance against budget' },
    { value: 'aging', label: 'Aging Report', description: 'Outstanding receivables by period' }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Print Header - only shows when printing */}
      <div className="hidden print:block p-8 border-b">
        <h1 className="text-2xl font-bold">V2 Ecosystem</h1>
        <p className="text-gray-600">
          {reportTypes.find(t => t.value === reportType)?.label}
        </p>
        <p className="text-gray-600">
          Period: {dateRange.from && formatDate(dateRange.from)} — {dateRange.to && formatDate(dateRange.to)}
        </p>
        <p className="text-gray-600">Generated: {formatDate(new Date())}</p>
      </div>

      {/* Controls - hidden when printing */}
      <div className="print:hidden bg-gray-50 border-b p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Financial Reporting Pack</h1>
          
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium">Report Type</label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger className="w-80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {reportTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex flex-col items-start">
                        <span>{type.label}</span>
                        <span className="text-xs text-muted-foreground">{type.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label htmlFor="from-date" className="text-sm font-medium">From</label>
              <input
                id="from-date"
                type="date"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={dateRange.from ? dateRange.from.toISOString().split('T')[0] : ''}
                onChange={(e) => setDateRange({ ...dateRange, from: e.target.valueAsDate || undefined })}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="to-date" className="text-sm font-medium">To</label>
              <input
                id="to-date"
                type="date"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={dateRange.to ? dateRange.to.toISOString().split('T')[0] : ''}
                onChange={(e) => setDateRange({ ...dateRange, to: e.target.valueAsDate || undefined })}
              />
            </div>

            <Button onClick={generateReport} disabled={loading}>
              <FileText className="h-4 w-4 mr-2" />
              {loading ? 'Generating...' : 'Generate Report'}
            </Button>

            <div className="flex gap-2 ml-auto">
              <Button variant="outline" size="sm" onClick={() => exportReport('excel')}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportReport('csv')}>
                <Download className="h-4 w-4 mr-2" />
                CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Report Content */}
      <main className="max-w-7xl mx-auto p-6">
        {!report && !loading && (
          <Card className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium text-gray-600">Select a report type and date range to generate</p>
            <p className="text-sm text-gray-400 mt-2">
              These reports are formatted for printing and export. They contain detailed financial data for audit and analysis.
            </p>
          </Card>
        )}

        {loading && (
          <Card className="p-12 text-center">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 rounded w-1/3 mx-auto" />
              <div className="h-32 bg-gray-200 rounded" />
              <div className="h-64 bg-gray-200 rounded" />
            </div>
          </Card>
        )}

        {report && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-4 print:grid-cols-4">
              <Card className="print:border print:shadow-none">
                <CardContent className="p-4">
                  <p className="text-sm text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold">{formatCurrency(report.summary.total_revenue)}</p>
                </CardContent>
              </Card>
              <Card className="print:border print:shadow-none">
                <CardContent className="p-4">
                  <p className="text-sm text-gray-600">Total Costs</p>
                  <p className="text-2xl font-bold">{formatCurrency(report.summary.total_costs)}</p>
                </CardContent>
              </Card>
              <Card className="print:border print:shadow-none">
                <CardContent className="p-4">
                  <p className="text-sm text-gray-600">Gross Margin</p>
                  <p className="text-2xl font-bold">{formatCurrency(report.summary.gross_margin)}</p>
                </CardContent>
              </Card>
              <Card className="print:border print:shadow-none">
                <CardContent className="p-4">
                  <p className="text-sm text-gray-600">Transactions</p>
                  <p className="text-2xl font-bold">{report.summary.booking_count}</p>
                </CardContent>
              </Card>
            </div>

            {/* Detail Table */}
            <Card className="print:border print:shadow-none">
              <CardHeader className="print:pb-2">
                <CardTitle className="text-lg">Detail</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="print:bg-gray-100">
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="print:hidden">Reference</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.rows.map((row, i) => (
                        <TableRow key={i} className="print:break-inside-avoid">
                          <TableCell>{formatDate(new Date(row.date))}</TableCell>
                          <TableCell>{row.description}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{row.category}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(row.amount)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={row.status === 'confirmed' ? 'default' : 'secondary'}>
                              {row.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground print:hidden">
                            {row.reference}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Footnotes */}
            {report.footnotes.length > 0 && (
              <div className="text-sm text-gray-600 space-y-1 print:text-xs">
                <p className="font-medium">Notes:</p>
                {report.footnotes.map((note, i) => (
                  <p key={i}>{i + 1}. {note}</p>
                ))}
              </div>
            )}

            {/* Footer for print */}
            <div className="hidden print:block mt-8 pt-4 border-t text-xs text-gray-500">
              <p>Confidential - For internal use only</p>
              <p>Generated by V2 Ecosystem Analytics System</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
