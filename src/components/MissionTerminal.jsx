import { useEffect, useRef, useState } from 'react';
import {
  Box, Drawer, DrawerBody, DrawerContent, DrawerOverlay,
  Flex, IconButton, Input, Text, useDisclosure,
} from '@chakra-ui/react';
import { BOOT_LINES, COMMANDS, C, dim, err } from '../data/terminalCommands';

const PROMPT = 'HALP://$ ';
const MAX_INPUT = 120;

function TermLine({ color, text }) {
  return (
    <Text
      fontFamily="mono" fontSize="xs" color={color}
      whiteSpace="pre-wrap" lineHeight="1.6" userSelect="text"
    >
      {text}
    </Text>
  );
}

export default function MissionTerminal() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const btnRef    = useRef();
  const bottomRef = useRef();
  const inputRef  = useRef();

  const [lines,   setLines]   = useState(BOOT_LINES);
  const [input,   setInput]   = useState('');
  const [busy,    setBusy]    = useState(false);
  const [history, setHistory] = useState([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  const push = (newLines) => setLines((prev) => [...prev, ...newLines]);

  const handleCommand = async (raw) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    push([{ text: PROMPT + trimmed, color: C.green }]);
    setHistory((prev) => [trimmed, ...prev].slice(0, 50));
    setHistIdx(-1);
    setInput('');

    // Parse: first token is command, rest are args
    const [cmd, ...args] = trimmed.toLowerCase().split(/\s+/);

    if (cmd === 'clear') { setLines(BOOT_LINES); return; }

    const command = COMMANDS[cmd];
    if (!command) {
      push([err(`Not found: '${cmd}'`), dim("Type 'help' for commands."), dim('')]);
      return;
    }

    setBusy(true);
    push([dim('Processing...')]);
    try {
      const output = await command(args);
      setLines((prev) => [...prev.slice(0, -1), ...output, dim('')]);
    } catch (e) {
      setLines((prev) => [...prev.slice(0, -1), err(`ERROR: ${e.message}`), dim('')]);
    } finally {
      setBusy(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { handleCommand(input); return; }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.min(histIdx + 1, history.length - 1);
      setHistIdx(next);
      setInput(history[next] ?? '');
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = histIdx - 1;
      setHistIdx(next);
      setInput(next < 0 ? '' : (history[next] ?? ''));
    }
  };

  return (
    <>
      <IconButton
        ref={btnRef}
        icon={<Box as="img" src="/hal9000.png" alt="Mission Terminal" borderRadius="full" boxSize="28px" />}
        variant="ghost"
        colorScheme="green"
        onClick={onOpen}
        aria-label="Open Mission Terminal"
      />

      <Drawer isOpen={isOpen} placement="right" onClose={onClose} finalFocusRef={btnRef} size="md">
        <DrawerOverlay backdropFilter="blur(4px)" />
        <DrawerContent bg={C.bg} borderLeft="1px solid" borderColor={C.dim}>

          <Flex px={4} py={2} borderBottom="1px solid" borderColor={C.dim} align="center" justify="space-between">
            <Text fontFamily="mono" fontSize="xs" color={C.dim} letterSpacing="widest">
              HALP-9000  MISSION TERMINAL
            </Text>
            <IconButton
              size="xs" variant="ghost" aria-label="Close" onClick={onClose}
              color={C.dim} _hover={{ color: C.error }}
              icon={<Text fontFamily="mono" fontSize="sm" lineHeight={1}>X</Text>}
            />
          </Flex>

          <DrawerBody p={0} display="flex" flexDirection="column">
            <Box
              flex={1} overflowY="auto" px={4} py={3}
              css={{
                '&::-webkit-scrollbar': { width: '4px' },
                '&::-webkit-scrollbar-thumb': { background: C.dim },
              }}
            >
              {lines.map((l, i) => <TermLine key={i} color={l.color} text={l.text} />)}
              <div ref={bottomRef} />
            </Box>

            <Flex px={4} py={3} borderTop="1px solid" borderColor={C.dim} align="center" gap={1}>
              <Text fontFamily="mono" fontSize="xs" color={C.green} flexShrink={0}>
                {PROMPT}
              </Text>
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value.slice(0, MAX_INPUT))}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                isDisabled={busy}
                variant="unstyled"
                fontFamily="mono" fontSize={{ base: '16px', md: 'xs' }}
                color={C.green} caretColor={C.green}
                flex={1}
                _placeholder={{ color: C.dim, fontSize: '0.85em' }}
                placeholder={busy ? 'Processing...' : isFocused ? '' : "Type 'help'..."}
                spellCheck={false}
                autoComplete="off"
              />
            </Flex>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  );
}
