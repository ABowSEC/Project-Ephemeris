import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, Text } from '@chakra-ui/react';
import { ChevronRightIcon } from '@chakra-ui/icons';
import { Link as RouterLink } from 'react-router-dom';

export interface Crumb {
  label: string;
  /** Omit on the final/current crumb — it renders as plain text, not a link. */
  to?: string;
}

/**
 * Home > Section > Page trail. The visible counterpart to the BreadcrumbList
 * JSON-LD that functions/launches/[slug].ts stamps into the edge-rendered
 * shell — that script covers crawlers, this covers everyone else.
 */
export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <Breadcrumb
      spacing={2}
      separator={<ChevronRightIcon color="text.secondary" boxSize={3} />}
      fontSize="sm"
      color="text.secondary"
    >
      {items.map((item) => (
        <BreadcrumbItem key={item.label} isCurrentPage={!item.to}>
          {item.to ? (
            <BreadcrumbLink as={RouterLink} to={item.to} _hover={{ color: 'brand.300' }}>
              {item.label}
            </BreadcrumbLink>
          ) : (
            <Text as="span" color="text.primary" fontWeight="medium" noOfLines={1} maxW="280px">
              {item.label}
            </Text>
          )}
        </BreadcrumbItem>
      ))}
    </Breadcrumb>
  );
}
