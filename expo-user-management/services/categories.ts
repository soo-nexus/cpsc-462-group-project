import { supabase } from '../lib/supabase'
import { Category } from '../types'

export const categoryService = {
  async getCategories(): Promise<Category[]> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name')
    if (error) throw error
    return data || []
  },
}
