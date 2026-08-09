-- Make newly replaced RPC argument names available to Supabase REST immediately.
notify pgrst, 'reload schema';
