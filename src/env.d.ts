/// <reference types="../worker-configuration.d.ts" />

type CfRuntime = import("@astrojs/cloudflare").Runtime<Env>;

declare namespace App {
  interface Locals extends CfRuntime {
    user: import("@supabase/supabase-js").User | null;
  }
}
