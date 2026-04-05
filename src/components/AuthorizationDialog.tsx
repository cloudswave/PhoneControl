import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import styles from "./AuthorizationDialog.module.css";

interface AuthorizationDialogProps {
  onAuthorized: () => void;
}

export function AuthorizationDialog({
  onAuthorized,
}: AuthorizationDialogProps) {
  const [licenseKey, setLicenseKey] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState("");

  const handleVerify = async () => {
    if (!licenseKey.trim()) {
      setError("请输入授权码");
      return;
    }

    setIsVerifying(true);
    setError("");

    try {
      // 调用后端的 verify_authorization 命令，只传递授权码
      // 机器码由后端根据 MAC 地址自动生成
      const result = await invoke<{ status: string; message?: string }>(
        "verify_authorization",
        {
          licenseKey: licenseKey.trim(),
        },
      );

      if (result.status === "success") {
        // 授权成功，后端已保存签名
        onAuthorized();
      } else {
        throw new Error(result.message || "授权失败");
      }
    } catch (err) {
      setError(
        typeof err === "string"
          ? err
          : (err as Error).message || "授权失败，请重试",
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleVerify();
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.dialog}>
        <h2 className={styles.title}>软件授权</h2>
        <p className={styles.description}>首次使用需要授权激活，请输入授权码</p>
        <p className={styles.hint}>可关注微信公众号: 搞机Geek 获取授权码</p>

        <div className={styles.inputGroup}>
          <input
            type="text"
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="请输入授权码"
            className={styles.input}
            disabled={isVerifying}
          />
          {error && <div className={styles.error}>{error}</div>}
        </div>

        <div className={styles.buttons}>
          <button
            onClick={handleVerify}
            disabled={isVerifying}
            className={styles.verifyButton}
          >
            {isVerifying ? "验证中..." : "验证授权码"}
          </button>
        </div>
      </div>
    </div>
  );
}
