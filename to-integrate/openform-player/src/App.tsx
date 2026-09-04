import { FormPlayer } from './components/FormPlayer'
import type { Form } from './types'
import formData from './form.json'

const form = formData as unknown as Form

function App() {
  return <FormPlayer form={form} />
}

export default App
