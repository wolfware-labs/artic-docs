import type { ThemeRegistration } from 'shiki';

export const MAIN_XAML = `<UserControl xmlns="https://artic.rs/ui"
             xmlns:x="https://artic.rs/markup"
             x:Class="hello::views::MainView"
             x:DataType="hello::vm::MainVm">
  <StackPanel Spacing="14" HorizontalAlignment="Center">
    <TextBlock Text="Hello, artic"
               Classes="title"/>
    <Button Content="Click me"
            Command="{Binding Increment}"/>
    <TextBlock Text="{Binding Label}"/>
  </StackPanel>
</UserControl>`;

export const VM_RS = `#[derive(ViewModel, Default)]
pub struct MainVm {
    count: Signal<u32>,
    #[memo(count)] label: Memo<String>,
}

impl MainVm {
    fn label(&self) -> String {
        format!("Clicked {} times", self.count.get())
    }

    #[command]
    fn increment(&self) {
        self.count.update(|n| *n += 1);
    }
}`;

/** Shiki theme that reuses the landing tokens, so code reads the same as the hero. */
export const articTheme: ThemeRegistration = {
  name: 'artic-navy',
  type: 'dark',
  colors: { 'editor.background': '#0b151e', 'editor.foreground': '#c9dbe8' },
  tokenColors: [
    { scope: ['entity.name.tag', 'punctuation.definition.tag'], settings: { foreground: '#8fa8e8' } },
    { scope: ['entity.other.attribute-name'], settings: { foreground: '#6cc3c0' } },
    { scope: ['string', 'string.quoted'], settings: { foreground: '#e6c07b' } },
    { scope: ['keyword', 'storage.type', 'storage.modifier'], settings: { foreground: '#c792ea' } },
    {
      scope: ['entity.name.type', 'support.type', 'support.type.primitive', 'entity.name.type.struct'],
      settings: { foreground: '#82cfe8' },
    },
    {
      scope: ['entity.name.function', 'support.function', 'entity.name.function.macro'],
      settings: { foreground: '#8fa8e8' },
    },
    {
      scope: ['meta.attribute', 'punctuation.definition.attribute', 'meta.attribute.rust'],
      settings: { foreground: '#8aa3b8' },
    },
    { scope: ['constant.numeric'], settings: { foreground: '#e6c07b' } },
  ],
};

export const COMMANDS = {
  rustup: "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh",
  install: 'cargo install artic-cli',
  create: 'cargo artic new hello && cd hello',
  run: 'cargo run --features hot-reload',
} as const;
