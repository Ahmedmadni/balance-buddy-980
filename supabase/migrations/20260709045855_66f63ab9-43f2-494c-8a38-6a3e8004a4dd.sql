
DROP POLICY IF EXISTS "transactions: owner all" ON public.transactions;
CREATE POLICY "transactions: owner all" ON public.transactions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "zakat_settings_own" ON public.zakat_settings;
CREATE POLICY "zakat_settings_own" ON public.zakat_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "exchange_rates_own" ON public.exchange_rates;
CREATE POLICY "exchange_rates_own" ON public.exchange_rates FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
