-- Migration: Engine runtime gap tables (2026-11-10)
--
-- Purpose: bring the hosted Supabase project to schema parity with the
-- local supabase stack for eight tables that committed code references
-- (i18n.service.ts and tenant-scope contract docs) but that were never
-- defined by any repo migration — they existed only where they had been
-- created by runtime bootstrapping. Without this migration a deploy of
-- HEAD would break the i18n endpoints on the hosted project.
--
-- Source of truth: pg_dump --schema-only of the local supabase stack
-- (supabase_db_v2-ecosystem), taken 2026-11-10. Applied non-destructively:
-- the hosted project has none of these tables (verified by table diff).
--
-- Tables: content_translations, guest_language_preferences,
-- property_languages, translation_bundles, translation_memory,
-- menu_item_modifiers, menu_modifier_groups, menu_modifier_options
-- (the last three carry the hardened tenant-isolation policy set that
-- calls public.user_has_tenant_access / public.user_has_role — both
-- confirmed present on the hosted project).
--
-- RLS hardening decision (2026-11-10): the local dump has RLS enabled on
-- the 3 modifier tables but NOT on the 5 i18n tables. This migration
-- enables RLS (deny-by-default, no policies) on the i18n five as well.
-- Evidence: the only in-tree access path to these tables is the backend
-- service-role client (database/supabase.ts getSupabase), which bypasses
-- RLS, so no committed behavior changes; no anon-key client exists in
-- backend/frontend/mobile/wizard1 (config.supabase.anonKey is read but
-- never used). On the hosted project an RLS-disabled public table is
-- reachable over PostgREST by the anon key — guest_language_preferences
-- and content_translations must not be exposed that way. Local stack:
-- apply the same 5 ENABLE statements after this migration ships to keep
-- the two environments identical. (Statements placed at the end of this
-- file, after the CREATE TABLE bodies.)
--
-- PostgreSQL database dump
--

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: content_translations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_translations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    field_name text NOT NULL,
    language_code text NOT NULL,
    value text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    created_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT content_translations_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text])))
);


--
-- Name: guest_language_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.guest_language_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    guest_id uuid NOT NULL,
    preferred_language text DEFAULT 'en'::text NOT NULL,
    secondary_language text,
    email_language text DEFAULT 'en'::text NOT NULL,
    sms_language text DEFAULT 'en'::text NOT NULL,
    detection_source text DEFAULT 'explicit'::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: menu_item_modifiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menu_item_modifiers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    catalog_item_id uuid,
    modifier_group_id uuid,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    tenant_id uuid NOT NULL,
    property_id uuid NOT NULL
);


--
-- Name: menu_modifier_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menu_modifier_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    module_id uuid,
    name text NOT NULL,
    min_selections integer DEFAULT 0,
    max_selections integer DEFAULT 1,
    is_required boolean DEFAULT false,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    tenant_id uuid NOT NULL,
    property_id uuid NOT NULL
);


--
-- Name: menu_modifier_options; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menu_modifier_options (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    modifier_group_id uuid,
    name text NOT NULL,
    price_adjustment numeric(10,2) DEFAULT 0,
    is_available boolean DEFAULT true,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    tenant_id uuid NOT NULL,
    property_id uuid NOT NULL
);


--
-- Name: property_languages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.property_languages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    property_id uuid NOT NULL,
    language_code text NOT NULL,
    language_name text NOT NULL,
    native_name text,
    is_default boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    date_format text DEFAULT 'MM/DD/YYYY'::text NOT NULL,
    time_format text DEFAULT '12h'::text NOT NULL,
    currency_format text,
    number_format text,
    translation_progress integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: translation_bundles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.translation_bundles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    property_id uuid,
    language_code text NOT NULL,
    context text DEFAULT 'ui'::text NOT NULL,
    bundle jsonb DEFAULT '{}'::jsonb NOT NULL,
    checksum text,
    key_count integer DEFAULT 0,
    generated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: translation_memory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.translation_memory (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_language text NOT NULL,
    target_language text NOT NULL,
    source_text text NOT NULL,
    translated_text text NOT NULL,
    context text,
    domain text DEFAULT 'hospitality'::text NOT NULL,
    quality_score numeric(3,2),
    usage_count integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: content_translations content_translations_entity_type_entity_id_field_name_langu_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_translations
    ADD CONSTRAINT content_translations_entity_type_entity_id_field_name_langu_key UNIQUE (entity_type, entity_id, field_name, language_code);


--
-- Name: content_translations content_translations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_translations
    ADD CONSTRAINT content_translations_pkey PRIMARY KEY (id);


--
-- Name: guest_language_preferences guest_language_preferences_guest_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guest_language_preferences
    ADD CONSTRAINT guest_language_preferences_guest_id_key UNIQUE (guest_id);


--
-- Name: guest_language_preferences guest_language_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guest_language_preferences
    ADD CONSTRAINT guest_language_preferences_pkey PRIMARY KEY (id);


--
-- Name: menu_item_modifiers menu_item_modifiers_catalog_item_id_modifier_group_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_item_modifiers
    ADD CONSTRAINT menu_item_modifiers_catalog_item_id_modifier_group_id_key UNIQUE (catalog_item_id, modifier_group_id);


--
-- Name: menu_item_modifiers menu_item_modifiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_item_modifiers
    ADD CONSTRAINT menu_item_modifiers_pkey PRIMARY KEY (id);


--
-- Name: menu_modifier_groups menu_modifier_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_modifier_groups
    ADD CONSTRAINT menu_modifier_groups_pkey PRIMARY KEY (id);


--
-- Name: menu_modifier_options menu_modifier_options_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_modifier_options
    ADD CONSTRAINT menu_modifier_options_pkey PRIMARY KEY (id);


--
-- Name: property_languages property_languages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_languages
    ADD CONSTRAINT property_languages_pkey PRIMARY KEY (id);


--
-- Name: property_languages property_languages_property_id_language_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_languages
    ADD CONSTRAINT property_languages_property_id_language_code_key UNIQUE (property_id, language_code);


--
-- Name: translation_bundles translation_bundles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.translation_bundles
    ADD CONSTRAINT translation_bundles_pkey PRIMARY KEY (id);


--
-- Name: translation_bundles translation_bundles_property_id_language_code_context_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.translation_bundles
    ADD CONSTRAINT translation_bundles_property_id_language_code_context_key UNIQUE NULLS NOT DISTINCT (property_id, language_code, context);


--
-- Name: translation_memory translation_memory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.translation_memory
    ADD CONSTRAINT translation_memory_pkey PRIMARY KEY (id);


--
-- Name: translation_memory translation_memory_source_language_target_language_source_t_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.translation_memory
    ADD CONSTRAINT translation_memory_source_language_target_language_source_t_key UNIQUE (source_language, target_language, source_text);


--
-- Name: idx_content_translations_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_content_translations_entity ON public.content_translations USING btree (entity_type, entity_id, language_code);


--
-- Name: idx_property_languages_property; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_property_languages_property ON public.property_languages USING btree (property_id);


--
-- Name: idx_translation_bundles_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_translation_bundles_lookup ON public.translation_bundles USING btree (language_code, context);


--
-- Name: menu_item_modifiers menu_item_modifiers_catalog_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_item_modifiers
    ADD CONSTRAINT menu_item_modifiers_catalog_item_id_fkey FOREIGN KEY (catalog_item_id) REFERENCES public.catalog_items(id) ON DELETE CASCADE;


--
-- Name: menu_item_modifiers menu_item_modifiers_modifier_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_item_modifiers
    ADD CONSTRAINT menu_item_modifiers_modifier_group_id_fkey FOREIGN KEY (modifier_group_id) REFERENCES public.menu_modifier_groups(id) ON DELETE CASCADE;


--
-- Name: menu_item_modifiers menu_item_modifiers_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_item_modifiers
    ADD CONSTRAINT menu_item_modifiers_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;


--
-- Name: menu_item_modifiers menu_item_modifiers_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_item_modifiers
    ADD CONSTRAINT menu_item_modifiers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: menu_modifier_groups menu_modifier_groups_module_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_modifier_groups
    ADD CONSTRAINT menu_modifier_groups_module_id_fkey FOREIGN KEY (module_id) REFERENCES public.modules(id) ON DELETE CASCADE;


--
-- Name: menu_modifier_groups menu_modifier_groups_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_modifier_groups
    ADD CONSTRAINT menu_modifier_groups_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;


--
-- Name: menu_modifier_groups menu_modifier_groups_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_modifier_groups
    ADD CONSTRAINT menu_modifier_groups_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: menu_modifier_options menu_modifier_options_modifier_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_modifier_options
    ADD CONSTRAINT menu_modifier_options_modifier_group_id_fkey FOREIGN KEY (modifier_group_id) REFERENCES public.menu_modifier_groups(id) ON DELETE CASCADE;


--
-- Name: menu_modifier_options menu_modifier_options_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_modifier_options
    ADD CONSTRAINT menu_modifier_options_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;


--
-- Name: menu_modifier_options menu_modifier_options_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_modifier_options
    ADD CONSTRAINT menu_modifier_options_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: menu_item_modifiers Public can view menu item modifiers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view menu item modifiers" ON public.menu_item_modifiers FOR SELECT USING (true);


--
-- Name: menu_item_modifiers Staff can manage menu item modifiers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage menu item modifiers" ON public.menu_item_modifiers USING ((EXISTS ( SELECT 1
   FROM (public.user_roles ur
     JOIN public.roles r ON ((ur.role_id = r.id)))
  WHERE ((ur.user_id = auth.uid()) AND ((r.name)::text = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'staff'::character varying, 'manager'::character varying])::text[]))))));


--
-- Name: menu_modifier_groups hardened_modifiers_staff_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hardened_modifiers_staff_manage ON public.menu_modifier_groups TO authenticated USING ((public.user_has_role('staff'::text) OR public.user_has_role('manager'::text) OR public.user_has_role('admin'::text))) WITH CHECK ((public.user_has_role('staff'::text) OR public.user_has_role('manager'::text) OR public.user_has_role('admin'::text)));


--
-- Name: menu_modifier_options hardened_options_staff_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hardened_options_staff_manage ON public.menu_modifier_options TO authenticated USING ((public.user_has_role('staff'::text) OR public.user_has_role('manager'::text) OR public.user_has_role('admin'::text))) WITH CHECK ((public.user_has_role('staff'::text) OR public.user_has_role('manager'::text) OR public.user_has_role('admin'::text)));


--
-- Name: menu_item_modifiers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.menu_item_modifiers ENABLE ROW LEVEL SECURITY;

--
-- Name: menu_item_modifiers menu_item_modifiers_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY menu_item_modifiers_isolation ON public.menu_item_modifiers USING ((public.user_has_tenant_access(auth.uid(), tenant_id) AND public.user_has_property_access(auth.uid(), property_id)));


--
-- Name: menu_modifier_groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.menu_modifier_groups ENABLE ROW LEVEL SECURITY;

--
-- Name: menu_modifier_groups menu_modifier_groups_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY menu_modifier_groups_isolation ON public.menu_modifier_groups USING ((public.user_has_tenant_access(auth.uid(), tenant_id) AND public.user_has_property_access(auth.uid(), property_id)));


--
-- Name: menu_modifier_options; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.menu_modifier_options ENABLE ROW LEVEL SECURITY;

--
-- Name: menu_modifier_options menu_modifier_options_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY menu_modifier_options_isolation ON public.menu_modifier_options USING ((public.user_has_tenant_access(auth.uid(), tenant_id) AND public.user_has_property_access(auth.uid(), property_id)));


--
-- Name: menu_modifier_groups staff_admin_manage_modifier_groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_admin_manage_modifier_groups ON public.menu_modifier_groups TO authenticated USING ((public.user_has_role('staff'::text) OR public.user_has_role('manager'::text) OR public.user_has_role('admin'::text))) WITH CHECK ((public.user_has_role('staff'::text) OR public.user_has_role('manager'::text) OR public.user_has_role('admin'::text)));


--
-- Name: menu_modifier_options staff_admin_manage_modifier_options; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_admin_manage_modifier_options ON public.menu_modifier_options TO authenticated USING ((public.user_has_role('staff'::text) OR public.user_has_role('manager'::text) OR public.user_has_role('admin'::text))) WITH CHECK ((public.user_has_role('staff'::text) OR public.user_has_role('manager'::text) OR public.user_has_role('admin'::text)));


--
-- Name: menu_modifier_groups staff_manage_modifier_groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_manage_modifier_groups ON public.menu_modifier_groups TO authenticated USING ((public.user_has_role('staff'::text) OR public.user_has_role('manager'::text) OR public.user_has_role('admin'::text))) WITH CHECK ((public.user_has_role('staff'::text) OR public.user_has_role('manager'::text) OR public.user_has_role('admin'::text)));


--
-- Name: menu_modifier_options staff_manage_modifier_options; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_manage_modifier_options ON public.menu_modifier_options TO authenticated USING ((public.user_has_role('staff'::text) OR public.user_has_role('manager'::text) OR public.user_has_role('admin'::text))) WITH CHECK ((public.user_has_role('staff'::text) OR public.user_has_role('manager'::text) OR public.user_has_role('admin'::text)));


--
-- PostgreSQL database dump complete
-- (pg_dump psql directives \restrict /\unrestrict removed: this file
-- executes through node-postgres, not psql.)
--

-- ============================================================
-- RLS hardening: i18n five (deny-by-default; service_role bypasses)
-- Runs last, after all tables exist.
-- ============================================================
ALTER TABLE public.content_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_language_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_languages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.translation_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.translation_memory ENABLE ROW LEVEL SECURITY;

