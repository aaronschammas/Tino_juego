'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiDownload, apiGetCached } from '@/lib/api';
import { ReportPreviewResponse } from '@/types/analytics';

export interface ReportFilters {
  projectId: string | 'all';
  userId: string | 'all';
  status: string | 'all';
  startDate: string | null;
  endDate: string | null;
}

const REPORT_STALE_TIME_MS = 15_000;

export function createDefaultReportFilters(): ReportFilters {
  return {
    projectId: 'all',
    userId: 'all',
    status: 'all',
    startDate: null,
    endDate: null,
  };
}

export function buildReportQuery(filters: ReportFilters) {
  const params = new URLSearchParams();
  if (filters.startDate) params.set('from', filters.startDate);
  if (filters.endDate) params.set('to', filters.endDate);
  if (filters.projectId !== 'all') params.set('projectIds', filters.projectId);
  if (filters.userId !== 'all') params.set('userIds', filters.userId);
  if (filters.status !== 'all') params.set('statuses', filters.status);
  return params.toString();
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function reportEndpoint(path: string, query: string) {
  return `/analytics/report/${path}${query ? `?${query}` : ''}`;
}

export function useReport(isOpen: boolean) {
  const [filters, setFilters] = useState<ReportFilters>(() => createDefaultReportFilters());
  const [preview, setPreview] = useState<ReportPreviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState<'pdf' | 'excel' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const query = useMemo(() => buildReportQuery(filters), [filters]);

  const fetchPreview = useCallback(
    async (force = false) => {
      if (!isOpen) return;
      const currentRequest = ++requestId.current;
      setIsLoading(true);
      setError(null);

      try {
        const data = await apiGetCached<ReportPreviewResponse>(reportEndpoint('preview', query), {
          staleTime: REPORT_STALE_TIME_MS,
          force,
        });
        if (currentRequest === requestId.current) setPreview(data);
      } catch (requestError) {
        if (currentRequest === requestId.current) {
          setPreview(null);
          setError(requestError instanceof Error ? requestError.message : 'No se pudo cargar el informe');
        }
      } finally {
        if (currentRequest === requestId.current) setIsLoading(false);
      }
    },
    [isOpen, query],
  );

  const download = useCallback(
    async (format: 'pdf' | 'excel') => {
      setDownloadingFormat(format);
      setError(null);
      try {
        const blob = await apiDownload(reportEndpoint(format, query));
        downloadBlob(blob, format === 'pdf' ? 'informe-tino.pdf' : 'informe-tino.xls');
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'No se pudo descargar el informe');
      } finally {
        setDownloadingFormat(null);
      }
    },
    [query],
  );

  useEffect(() => {
    if (!isOpen) return;
    const timeoutId = setTimeout(() => void fetchPreview(), 250);
    return () => clearTimeout(timeoutId);
  }, [fetchPreview, isOpen]);

  return {
    filters,
    setFilters,
    preview,
    isLoading,
    downloadingFormat,
    error,
    refetch: () => fetchPreview(true),
    download,
  };
}
