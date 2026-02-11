"use client";

import { useState, useEffect, useCallback } from "react";
import type { ConsentStatusResponse } from "@/lib/consent/types";

export default function HealthConsentPage() {
  const [consentStatus, setConsentStatus] = useState<ConsentStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [deleteData, setDeleteData] = useState(false);

  const fetchConsentStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/health/consent");
      if (!res.ok) throw new Error("获取授权状态失败");
      const data = await res.json();
      setConsentStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConsentStatus();
  }, [fetchConsentStatus]);

  async function handleGrantConsent() {
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/health/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acknowledgedTerms: true,
          version: "v1.0",
        }),
      });
      if (!res.ok) throw new Error("授权失败");
      const data = await res.json();
      setConsentStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "授权失败");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRevokeConsent() {
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/health/consent", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deleteData,
          reason: "用户主动撤销",
        }),
      });
      if (!res.ok) throw new Error("撤销授权失败");
      const data = await res.json();
      setConsentStatus(data);
      setShowRevokeConfirm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "撤销授权失败");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return "-";
    return new Date(timestamp).toLocaleString("zh-CN");
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">健康数据授权管理</h1>
        <p className="text-gray-500 mt-1">管理你的健康数据同步授权和隐私设置</p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">当前授权状态</h2>
              <p className="text-sm text-gray-500 mt-1">
                控制是否允许同步你的健康数据用于健康咨询分析
              </p>
            </div>
            <div
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                consentStatus?.hasConsent
                  ? "bg-green-100 text-green-800"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {consentStatus?.hasConsent ? "已授权" : "未授权"}
            </div>
          </div>

          <div className="space-y-4 mb-6">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">状态</span>
              <span className="font-medium text-gray-900">
                {consentStatus?.status === "GRANTED"
                  ? "已授权"
                  : consentStatus?.status === "REVOKED"
                  ? "已撤销"
                  : "未授权"}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">授权时间</span>
              <span className="font-medium text-gray-900">
                {formatDate(consentStatus?.grantedAt)}
              </span>
            </div>
            {consentStatus?.revokedAt && (
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">撤销时间</span>
                <span className="font-medium text-gray-900">
                  {formatDate(consentStatus.revokedAt)}
                </span>
              </div>
            )}
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">条款版本</span>
              <span className="font-medium text-gray-900">
                {consentStatus?.version || "-"}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-600">数据范围</span>
              <span className="font-medium text-gray-900 text-right">
                {consentStatus?.scope?.metrics?.join(", ") || "体重、BMI、睡眠、心率、HRV"}
              </span>
            </div>
          </div>

          {!consentStatus?.hasConsent ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800 mb-3">
                <strong>授权说明：</strong>
                授权后，你的健康数据将被同步用于生成个性化健康报告和异常检测。
                你随时可以在本页面撤销授权。
              </p>
              <ul className="text-sm text-blue-700 list-disc list-inside space-y-1">
                <li>数据仅用于你的个人健康分析</li>
                <li>可随时撤销授权并删除数据</li>
                <li>撤销后无法继续同步新数据</li>
              </ul>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-amber-800">
                <strong>提示：</strong>
                撤销授权后，你的健康数据同步将被立即阻止，且无法生成新的健康分析报告。
              </p>
            </div>
          )}

          {!consentStatus?.hasConsent ? (
            <button
              type="button"
              onClick={handleGrantConsent}
              disabled={actionLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white py-3 px-4 rounded-lg font-medium transition-colors"
            >
              {actionLoading ? "处理中..." : "授权健康数据同步"}
            </button>
          ) : (
            <>
              {!showRevokeConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowRevokeConfirm(true)}
                  className="w-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 py-3 px-4 rounded-lg font-medium transition-colors"
                >
                  撤销授权
                </button>
              ) : (
                <div className="space-y-4">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={deleteData}
                      onChange={(e) => setDeleteData(e.target.checked)}
                      className="mt-1"
                    />
                    <span className="text-sm text-gray-700">
                      同时删除已同步的健康数据
                    </span>
                  </label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleRevokeConsent}
                      disabled={actionLoading}
                      className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white py-3 px-4 rounded-lg font-medium transition-colors"
                    >
                      {actionLoading ? "处理中..." : "确认撤销"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRevokeConfirm(false)}
                      disabled={actionLoading}
                      className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-4 rounded-lg font-medium transition-colors"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="font-medium text-gray-900 mb-2">关于健康数据授权</h3>
        <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
          <li>授权是进行健康数据同步的必要条件</li>
          <li>撤销授权会立即阻止新的数据同步请求</li>
          <li>所有授权操作都会被记录在审计日志中</li>
          <li>原始数据保留 7 天，周汇总数据保留 90 天</li>
        </ul>
      </div>
    </div>
  );
}
