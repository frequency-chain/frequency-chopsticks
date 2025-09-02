import * as z from 'zod';
export declare const environmentSchema: z.ZodObject<{
    /**
     * Disable auto HRMP on setup. Default is `false`.
     */
    DISABLE_AUTO_HRMP: z.ZodEffects<z.ZodDefault<z.ZodEnum<["true", "false"]>>, boolean, "true" | "false" | undefined>;
    /**
     * Set port for Chopsticks to listen on, default is `8000`.
     */
    PORT: z.ZodOptional<z.ZodString>;
    /**
     * Disable plugins for faster startup. Default is `false`.
     */
    DISABLE_PLUGINS: z.ZodEffects<z.ZodDefault<z.ZodEnum<["true", "false"]>>, boolean, "true" | "false" | undefined>;
    HTTP_PROXY: z.ZodOptional<z.ZodString>;
    http_proxy: z.ZodOptional<z.ZodString>;
    HTTPS_PROXY: z.ZodOptional<z.ZodString>;
    https_proxy: z.ZodOptional<z.ZodString>;
    /**
     * Chopsticks log level, "fatal" | "error" | "warn" | "info" | "debug" | "trace".
     * Default is "info".
     */
    LOG_LEVEL: z.ZodDefault<z.ZodEnum<["fatal", "error", "warn", "info", "debug", "trace"]>>;
    /**
     * Don't truncate log messages, show full log output. Default is `false`.
     */
    VERBOSE_LOG: z.ZodEffects<z.ZodDefault<z.ZodEnum<["true", "false"]>>, boolean, "true" | "false" | undefined>;
    /**
     * Don't log objects. Default is `false`.
     */
    LOG_COMPACT: z.ZodEffects<z.ZodDefault<z.ZodEnum<["true", "false"]>>, boolean, "true" | "false" | undefined>;
}, "strip", z.ZodTypeAny, {
    DISABLE_AUTO_HRMP: boolean;
    DISABLE_PLUGINS: boolean;
    LOG_LEVEL: "fatal" | "error" | "warn" | "info" | "debug" | "trace";
    VERBOSE_LOG: boolean;
    LOG_COMPACT: boolean;
    PORT?: string | undefined;
    HTTP_PROXY?: string | undefined;
    http_proxy?: string | undefined;
    HTTPS_PROXY?: string | undefined;
    https_proxy?: string | undefined;
}, {
    DISABLE_AUTO_HRMP?: "true" | "false" | undefined;
    PORT?: string | undefined;
    DISABLE_PLUGINS?: "true" | "false" | undefined;
    HTTP_PROXY?: string | undefined;
    http_proxy?: string | undefined;
    HTTPS_PROXY?: string | undefined;
    https_proxy?: string | undefined;
    LOG_LEVEL?: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | undefined;
    VERBOSE_LOG?: "true" | "false" | undefined;
    LOG_COMPACT?: "true" | "false" | undefined;
}>;
/**
 * Environment variables available for users
 */
export declare const environment: {
    DISABLE_AUTO_HRMP: boolean;
    DISABLE_PLUGINS: boolean;
    LOG_LEVEL: "fatal" | "error" | "warn" | "info" | "debug" | "trace";
    VERBOSE_LOG: boolean;
    LOG_COMPACT: boolean;
    PORT?: string | undefined;
    HTTP_PROXY?: string | undefined;
    http_proxy?: string | undefined;
    HTTPS_PROXY?: string | undefined;
    https_proxy?: string | undefined;
};
