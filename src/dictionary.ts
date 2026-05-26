export interface EnvKeyInfo {
  value: string;
  description: string;
  group: string;
}

export const BUILT_IN_DICTIONARY: Record<string, EnvKeyInfo> = {
  "NODE_ENV": {
    "value": "production",
    "description": "The application's runtime environment (development, production, test) used to control compiler warnings and code optimization rules.",
    "group": "Application Environment"
  },
  "PORT": {
    "value": "3000",
    "description": "The network port on which the web server listens for incoming HTTP traffic.",
    "group": "Application Environment"
  },
  "DEBUG": {
    "value": "false",
    "description": "A boolean switch to toggle detailed error stacks in responses and verbose system logging.",
    "group": "Application Environment"
  },
  "APP_VERSION": {
    "value": "1.0.0",
    "description": "The official release version of the application, used to align build packaging and log error trace stacks.",
    "group": "Application Environment"
  },
  "LOG_LEVEL": {
    "value": "info",
    "description": "The minimum severity level (debug, info, warn, error, fatal) for outputting logs to optimize storage and memory usage.",
    "group": "Application Environment"
  },
  "DJANGO_SETTINGS_MODULE": {
    "value": "mysite.settings.production",
    "description": "The relative path to the configuration module for the Python Django framework engine.",
    "group": "Application Environment"
  },
  "DATABASE_URL": {
    "value": "postgresql://prod_user:secure_pass_123@localhost:5432/production_db",
    "description": "The complete connection URI containing the engine, credentials, host, and database name for the primary RDBMS.",
    "group": "Database & Cache"
  },
  "DATABASE_POOL_SIZE": {
    "value": "10",
    "description": "The maximum number of concurrent database connections in the connection pool to prevent bottlenecks and manage resources.",
    "group": "Database & Cache"
  },
  "REDIS_URL": {
    "value": "redis://:redis_password_999@127.0.0.1:6379/0",
    "description": "The connection URL for the high-performance in-memory key-value store, used for caching, sessions, and locks.",
    "group": "Database & Cache"
  },
  "REDIS_PASSWORD": {
    "value": "redis_secure_pass_777",
    "description": "The password required to authenticate and secure connections to the Redis in-memory storage server.",
    "group": "Database & Cache"
  },
  "MEMCACHED_URL": {
    "value": "localhost:11211",
    "description": "The server address for Memcached, a high-performance distributed memory object caching system.",
    "group": "Database & Cache"
  },
  "CACHE_TTL": {
    "value": "3600",
    "description": "The default Time To Live (TTL) in seconds defining the expiration period for cached data.",
    "group": "Database & Cache"
  },
  "SECRET_KEY": {
    "value": "django-insecure-32_character_random_string_here",
    "description": "A highly secure master cryptographic key used by the framework for session signing, encryption, and salting.",
    "group": "Security & Authentication"
  },
  "JWT_SECRET": {
    "value": "super-secret-random-token-signing-key-32-bytes",
    "description": "The secret key used to sign and verify JSON Web Tokens (JWT) for stateless user authentication.",
    "group": "Security & Authentication"
  },
  "GOOGLE_CLIENT_ID": {
    "value": "1234567890-example.apps.googleusercontent.com",
    "description": "The public client identifier used to initiate OAuth 2.0 social login flow with Google.",
    "group": "Security & Authentication"
  },
  "GOOGLE_CLIENT_SECRET": {
    "value": "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ere",
    "description": "The private client credential used by the backend to exchange Google OAuth authorization codes for access tokens.",
    "group": "Security & Authentication"
  },
  "AWS_ACCESS_KEY_ID": {
    "value": "AKIAIOSFODNN7EXAMPLE",
    "description": "The unique public identifier for IAM user accounts, used to authenticate requests to AWS public cloud resources.",
    "group": "Cloud Provider API"
  },
  "AWS_SECRET_ACCESS_KEY": {
    "value": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    "description": "The private cryptographic credential used to sign API requests to AWS public cloud services.",
    "group": "Cloud Provider API"
  },
  "GOOGLE_APPLICATION_CREDENTIALS": {
    "value": "/etc/secrets/gcp-service-account.json",
    "description": "The absolute system path to the GCP service account JSON key file used for secure platform access.",
    "group": "Cloud Provider API"
  },
  "GOOGLE_API_KEY": {
    "value": "AIzaSyA1_example_google_maps_api_key_value",
    "description": "A public API key used to identify and bill requests to Google Cloud client libraries like Maps or Places.",
    "group": "Cloud Provider API"
  },
  "AZURE_CLIENT_ID": {
    "value": "00000000-0000-0000-0000-000000000000",
    "description": "The unique client ID of the service principal registered in Azure Active Directory (AD).",
    "group": "Cloud Provider API"
  },
  "AZURE_CLIENT_SECRET": {
    "value": "azure_client_secret_value_here",
    "description": "The secret password used to authenticate the service principal and obtain Azure resource access tokens.",
    "group": "Cloud Provider API"
  },
  "FIREBASE_TOKEN": {
    "value": "1//0example_firebase_auth_token_value",
    "description": "The deployment access token used to authenticate automated builds and manage Firebase hosting and backend resources.",
    "group": "Cloud Provider API"
  },
  "OPENAI_API_KEY": {
    "value": "sk-proj-example_openai_api_key_value",
    "description": "The secret API key used to authenticate and bill requests to OpenAI's GPT models and embedding services.",
    "group": "AI & LLM Integration"
  },
  "GEMINI_API_KEY": {
    "value": "AIzaSyA1_example_gemini_api_key_value",
    "description": "The secure API key used to trigger and bill traffic for Google Gemini text and multimodal model services.",
    "group": "AI & LLM Integration"
  },
  "CLAUDE_API_KEY": {
    "value": "sk-ant-api03_example_claude_api_key_value",
    "description": "The unique authentication credential used to invoke Anthropic's Claude LLM and conversational agent APIs.",
    "group": "AI & LLM Integration"
  },
  "ANTHROPIC_API_KEY": {
    "value": "sk-ant-api03_example_anthropic_api_key_value",
    "description": "The standard environment variable recognized by Anthropic's SDK to connect to Claude LLM APIs.",
    "group": "AI & LLM Integration"
  },
  "LANGCHAIN_API_KEY": {
    "value": "lsv2_pt_example_langchain_api_key_value",
    "description": "The security authentication token used to orchestrate LangChain components and share hub resources.",
    "group": "AI & LLM Integration"
  },
  "LANGCHAIN_TRACING_V2": {
    "value": "true",
    "description": "A boolean switch to enable tracing of LangChain execution paths and send logs to LangSmith or local debuggers.",
    "group": "AI & LLM Integration"
  },
  "LANGSMITH_TRACING": {
    "value": "true",
    "description": "A boolean switch to monitor latency, performance, and errors of LLM chains and agents in real time on LangSmith.",
    "group": "AI & LLM Integration"
  },
  "LANGSMITH_PROJECT": {
    "value": "my-llm-project",
    "description": "The target project label used to identify and isolate tracing data on the LangSmith dashboard.",
    "group": "AI & LLM Integration"
  },
  "LANGSMITH_API_KEY": {
    "value": "lsv2_pt_example_langsmith_api_key_value",
    "description": "The service access token used to authorize real-time transmission of debugging and tracing packets to LangSmith.",
    "group": "AI & LLM Integration"
  },
  "LANGSMITH_ENDPOINT": {
    "value": "https://api.smith.langchain.com",
    "description": "The endpoint URL (cloud or on-premise) for collecting LangSmith tracing and debugging data.",
    "group": "AI & LLM Integration"
  },
  "STRIPE_API_KEY": {
    "value": "sk_live_51Nx...example",
    "description": "The secret API credential used to authenticate transactions with the Stripe payment gateway, which must never be exposed to clients.",
    "group": "Third-Party Integration"
  },
  "TWILIO_ACCOUNT_SID": {
    "value": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "description": "The unique account identifier required to authenticate and interact with Twilio communications APIs (SMS, Voice).",
    "group": "Third-Party Integration"
  },
  "TWILIO_AUTH_TOKEN": {
    "value": "twilio_auth_token_secret_value_here",
    "description": "The secret authorization token used in conjunction with the Twilio SID to verify API request authenticity.",
    "group": "Third-Party Integration"
  },
  "GITHUB_TOKEN": {
    "value": "ghp_secureGithubTokenValueHere12345",
    "description": "A personal access token used to perform read/write operations on GitHub repositories and interact with GitHub REST APIs.",
    "group": "CI/CD & Hosting Platforms"
  },
  "NEXT_PUBLIC_API_URL": {
    "value": "https://api.production.example.com",
    "description": "A public API gateway endpoint URL prefixed for Next.js to expose it to the browser bundle.",
    "group": "Framework & Build Configuration"
  },
  "NEXT_PUBLIC_ANALYTICS_ID": {
    "value": "G-GA123456",
    "description": "The unique tracking ID (e.g., Google Analytics) exposed to the client browser to collect visitor traffic data.",
    "group": "Framework & Build Configuration"
  }
};
