import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://dglmfqbnqzytyuprljyh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnbG1mcWJucXp5dHl1cHJsanloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MzY5MzgsImV4cCI6MjA4MDAxMjkzOH0.NVud0HJrKzqeWhbcli0eTl-RQaqolXHz4wymjQf_6D8";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
