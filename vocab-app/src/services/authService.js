import { supabase } from '../supabase';

const getSession = () => supabase.auth.getSession();

const onAuthStateChange = (callback) => supabase.auth.onAuthStateChange(callback);

const signInAnonymously = () => supabase.auth.signInAnonymously();

const signInWithGoogle = () => supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/`
  }
});

const signInWithPassword = ({ email, password }) => supabase.auth.signInWithPassword({
  email,
  password
});

const signUpWithEmail = ({ email, password }) => supabase.auth.signUp({
  email,
  password
});

const signOut = () => supabase.auth.signOut();

export {
  getSession,
  onAuthStateChange,
  signInAnonymously,
  signInWithGoogle,
  signInWithPassword,
  signUpWithEmail,
  signOut
};
