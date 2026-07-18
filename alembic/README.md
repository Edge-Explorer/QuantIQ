# Database Migrations (Alembic)

This directory contains the database migration scripts managed by Alembic. Alembic handles automatic schema updates, tracking revisions, and syncing database tables with SQLAlchemy models.

---

## Migration Commands Reference

### 1. Run Pending Migrations
To bring your local database (PostgreSQL/NeonDB) up to date with the latest schema changes:
```bash
uv run alembic upgrade head
```

### 2. Generate a New Migration
To create a new migration after editing SQLAlchemy models in `backend/app/database/models.py`:
```bash
uv run alembic revision --autogenerate -m "describe your changes"
```

### 3. Revert Migrations
To roll back the last applied migration:
```bash
uv run alembic downgrade -1
```

---

## Database Schema Evolution

The database schema has evolved through the following sequential revisions located in the `versions/` folder:

1. **Initial Schema (`3d7629451f7d_initial_schema.py`)**
   - Creates the core tables: `users` (credentials and subscription states), `watchlists` (user ticker lists), and `stock_history` (OHLCV candles).
2. **User Verification (`99690d55ee16_add_user_verification_columns.py`)**
   - Appends email verification tracking, registration verification codes, and expiration timestamps to the `users` table.
3. **Subscriptions & Message Limits (`bbdbf37359be_add_subscription_and_message_limit_.py`)**
   - Adds monthly credit bounds, API request trackers, and usage counters to enforce tiered subscription levels.
4. **Strategy Execution Logs (`887a33df9c3e_add_strategy_logs_table.py`)**
   - Creates the `strategy_logs` table to store quantitative backtesting parameters, accuracy scores, and performance logs.
5. **Saved Strategy Configurations (`1ffb20394fc4_add_saved_strategies.py`)**
   - Creates the `saved_strategies` table, allowing users to save and load strategy setups.
6. **Model Predictions Tracking (`31f4439fab74_add_prediction_logs_table.py`)**
   - Creates the `prediction_logs` table to log probability outputs, actual outcomes, and model scores from the specialized ONNX models.
7. **Asset Category Fields (`ea96300d7e57_add_asset_class_columns.py`)**
   - Adds category indicators (e.g. tech, crypto, index) to refine indicator logic per asset class.
8. **Threshold Alerts (`15639881888f_add_alert_trigger_columns.py`)**
   - Appends trigger states to the price alerts table to track when a stock crosses user-specified price bounds.
