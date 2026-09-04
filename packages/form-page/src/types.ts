export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type QuestionType =
  | 'short_text'
  | 'long_text'
  | 'dropdown'
  | 'checkboxes'
  | 'email'
  | 'phone'
  | 'number'
  | 'date'
  | 'rating'
  | 'opinion_scale'
  | 'yes_no'
  | 'file_upload'
  | 'url'

export type ThemePreset =
  | 'midnight'
  | 'ocean'
  | 'sunset'
  | 'forest'
  | 'lavender'
  | 'minimal'
  | 'high-contrast'

export interface ThemeConfig {
  id: ThemePreset
  name: string
  primaryColor: string
  backgroundColor: string
  textColor: string
  accentColor: string
  fontFamily: string
}

export interface QuestionConfig {
  id: string
  type: QuestionType
  title: string
  description?: string
  required: boolean
  options?: string[]
  minValue?: number
  maxValue?: number
  allowedFileTypes?: string[]
  maxFileSize?: number
  placeholder?: string
}

export interface Form {
  id: string
  title: string
  description: string | null
  slug: string
  theme: ThemePreset
  questions: QuestionConfig[]
  thank_you_message: string
}
